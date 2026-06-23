package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

//go:embed bundle.zip
var bundleZip []byte

const (
	appVersion  = "1.0.2"
	defaultPort = 3847
	maxPortTry  = 10
)

func main() {
	if err := run(); err != nil {
		showError(err)
		os.Exit(1)
	}
}

func run() error {
	base := filepath.Join(os.Getenv("LOCALAPPDATA"), "VET-MIS")
	if err := os.MkdirAll(base, 0o755); err != nil {
		return fmt.Errorf("crear carpeta base: %w", err)
	}

	pidFile := filepath.Join(base, "vet-mis.pid")

	// Si hay una instancia anterior corriendo, termínala (junto con su node.exe
	// gracias al Job Object que la instancia anterior habrá creado).
	killPreviousInstance(pidFile)

	// Registrar nuestro PID para que la próxima instancia pueda matarnos.
	if err := os.WriteFile(pidFile, []byte(strconv.Itoa(os.Getpid())), 0o644); err != nil {
		return fmt.Errorf("escribir pid: %w", err)
	}
	defer os.Remove(pidFile)

	// Crear un Windows Job Object con JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE.
	// Cuando este proceso muera (por cualquier motivo), el SO cierra el handle
	// del job y mata automáticamente a node.exe con él.
	job := createJobObject()
	// El handle del job se deja abierto intencionadamente; el SO lo cierra
	// cuando este proceso termina, lo que activa el kill automático de hijos.

	appDir, err := ensureAppExtracted()
	if err != nil {
		return err
	}

	dataDir := filepath.Join(base, "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("crear carpeta de datos: %w", err)
	}

	clientDist := filepath.Join(appDir, "client", "dist")
	nodeExe := filepath.Join(appDir, "runtime", "node.exe")
	serverEntry := filepath.Join(appDir, "server", "index.js")

	if _, err := os.Stat(nodeExe); err != nil {
		return fmt.Errorf("node embebido no encontrado: %w", err)
	}
	if _, err := os.Stat(serverEntry); err != nil {
		return fmt.Errorf("servidor no encontrado: %w", err)
	}

	port := findAvailablePort(defaultPort, maxPortTry)
	// Usar "localhost" (no "127.0.0.1") — Firebase Auth sólo autoriza localhost
	// por defecto; 127.0.0.1 no está en su lista de dominios permitidos.
	baseURL := fmt.Sprintf("http://localhost:%d", port)

	cmd := exec.Command(nodeExe, serverEntry)
	cmd.Dir = appDir
	cmd.Env = append(os.Environ(),
		"NODE_ENV=production",
		fmt.Sprintf("VET_MIS_PORT=%d", port),
		fmt.Sprintf("VET_MIS_DATA=%s", dataDir),
		fmt.Sprintf("VET_MIS_CLIENT_DIST=%s", clientDist),
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("iniciar servidor: %w", err)
	}

	// Unir node.exe al job para que muera con nosotros.
	assignToJob(job, cmd.Process)

	defer func() {
		_ = cmd.Process.Kill()
	}()

	if err := waitForServer(baseURL, 45*time.Second); err != nil {
		return err
	}

	if err := openBrowser(baseURL); err != nil {
		return err
	}

	return cmd.Wait()
}

// killPreviousInstance lee el archivo PID y termina la instancia anterior.
// Gracias al Job Object que esa instancia creó, su node.exe hijo también muere
// automáticamente cuando el launcher padre es terminado.
func killPreviousInstance(pidFile string) {
	data, err := os.ReadFile(pidFile)
	if err != nil {
		return // Sin instancia anterior
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		os.Remove(pidFile)
		return
	}

	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	openProcess := kernel32.NewProc("OpenProcess")
	terminateProcess := kernel32.NewProc("TerminateProcess")
	closeHandle := kernel32.NewProc("CloseHandle")

	// PROCESS_TERMINATE (0x0001) | PROCESS_QUERY_LIMITED_INFORMATION (0x1000)
	handle, _, _ := openProcess.Call(0x1001, 0, uintptr(pid))
	if handle != 0 {
		terminateProcess.Call(handle, 0)
		closeHandle.Call(handle)
		// Esperar a que el proceso anterior y su node.exe liberen el puerto.
		time.Sleep(2 * time.Second)
	}
	os.Remove(pidFile)
}

// createJobObject crea un Windows Job Object con la flag KILL_ON_JOB_CLOSE.
// Cualquier proceso asignado al job (node.exe) muere automáticamente cuando
// este proceso (el launcher) termina, sin importar la causa.
func createJobObject() syscall.Handle {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	createJobObjectW := kernel32.NewProc("CreateJobObjectW")
	setInformationJobObject := kernel32.NewProc("SetInformationJobObject")

	job, _, _ := createJobObjectW.Call(0, 0)
	if job == 0 {
		return 0
	}

	// Estructuras para JobObjectExtendedLimitInformation (clase 9)
	type basicLimitInfo struct {
		PerProcessUserTimeLimit int64
		PerJobUserTimeLimit     int64
		LimitFlags              uint32
		MinimumWorkingSetSize   uintptr
		MaximumWorkingSetSize   uintptr
		ActiveProcessLimit      uint32
		Affinity                uintptr
		PriorityClass           uint32
		SchedulingClass         uint32
	}
	type ioCounters struct {
		ReadOperationCount  uint64
		WriteOperationCount uint64
		OtherOperationCount uint64
		ReadTransferCount   uint64
		WriteTransferCount  uint64
		OtherTransferCount  uint64
	}
	type extendedLimitInfo struct {
		BasicLimitInformation basicLimitInfo
		IoInfo                ioCounters
		ProcessMemoryLimit    uintptr
		JobMemoryLimit        uintptr
		PeakProcessMemoryUsed uintptr
		PeakJobMemoryUsed     uintptr
	}

	info := extendedLimitInfo{}
	info.BasicLimitInformation.LimitFlags = 0x00002000 // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE

	setInformationJobObject.Call(
		job, 9,
		uintptr(unsafe.Pointer(&info)),
		uintptr(unsafe.Sizeof(info)),
	)
	return syscall.Handle(job)
}

// assignToJob agrega un proceso al job object para que muera junto al launcher.
func assignToJob(job syscall.Handle, proc *os.Process) {
	if job == 0 || proc == nil {
		return
	}
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	openProcess := kernel32.NewProc("OpenProcess")
	assignProcessToJobObject := kernel32.NewProc("AssignProcessToJobObject")
	closeHandle := kernel32.NewProc("CloseHandle")

	// PROCESS_ALL_ACCESS simplificado (suficiente para procesos del mismo usuario)
	handle, _, _ := openProcess.Call(0x1F0FFF, 0, uintptr(proc.Pid))
	if handle == 0 {
		return
	}
	defer closeHandle.Call(handle)
	assignProcessToJobObject.Call(uintptr(job), handle)
}

func ensureAppExtracted() (string, error) {
	base := filepath.Join(os.Getenv("LOCALAPPDATA"), "VET-MIS")
	appDir := filepath.Join(base, "app-"+appVersion)
	marker := filepath.Join(appDir, ".extracted")

	if _, err := os.Stat(marker); err == nil {
		return appDir, nil
	}

	if len(bundleZip) == 0 {
		return "", fmt.Errorf("bundle.zip vacío: ejecuta scripts/build-exe.ps1")
	}

	if err := os.RemoveAll(appDir); err != nil && !os.IsNotExist(err) {
		return "", err
	}
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return "", err
	}

	if err := extractZip(bundleZip, appDir); err != nil {
		return "", fmt.Errorf("extraer aplicación: %w", err)
	}

	if err := os.WriteFile(marker, []byte(appVersion), 0o644); err != nil {
		return "", err
	}
	return appDir, nil
}

func extractZip(data []byte, dest string) error {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	for _, f := range r.File {
		target := filepath.Join(dest, f.Name)
		if !filepath.HasPrefix(filepath.Clean(target), filepath.Clean(dest)) {
			return fmt.Errorf("ruta inválida en zip: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, f.Mode()); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(out, rc)
		out.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

func findAvailablePort(start, count int) int {
	for p := start; p < start+count; p++ {
		url := fmt.Sprintf("http://localhost:%d/api/dashboard/stats", p)
		resp, err := http.Get(url)
		if err != nil {
			return p
		}
		resp.Body.Close()
	}
	return start
}

func waitForServer(baseURL string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	url := baseURL + "/api/dashboard/stats"
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("el servidor no respondió a tiempo en %s", baseURL)
}

func openBrowser(url string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}

func showError(err error) {
	script := fmt.Sprintf(
		"Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('%s','VET-MIS',[System.Windows.MessageBoxButton]::OK,[System.Windows.MessageBoxImage]::Error)",
		escapePs(err.Error()),
	)
	_ = exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script).Run()
}

func escapePs(s string) string {
	return fmt.Sprintf("%q", s)
}
