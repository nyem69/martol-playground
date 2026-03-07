import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let connectedDevice: string | null = null;

export async function adbCommand(args: string): Promise<string> {
  console.log(`[adb] ${args}`);
  const { stdout, stderr } = await execAsync(`adb ${args}`, { timeout: 10000 });
  if (stderr && !stderr.includes('Warning') && !stderr.includes('daemon')) {
    console.log(`[adb] stderr: ${stderr.trim()}`);
  }
  const out = stdout.trim();
  console.log(`[adb] → ${out.substring(0, 200)}`);
  return out;
}

export async function connect(ip: string): Promise<string> {
  // Start adb server first
  try { await adbCommand('start-server'); } catch {}

  const result = await adbCommand(`connect ${ip}:5555`);
  if (result.includes('connected')) {
    connectedDevice = ip;

    // Verify the connection actually works
    const status = await getStatus();
    if (!status.connected) {
      return `Connection attempted but device not ready. TV response: ${result}`;
    }
  }
  return result;
}

export async function disconnect(): Promise<string> {
  const result = await adbCommand('disconnect');
  connectedDevice = null;
  return result;
}

export async function sendKey(keycode: string): Promise<string> {
  return adbCommand(`shell input keyevent ${keycode}`);
}

export async function sendText(text: string): Promise<string> {
  const escaped = text.replace(/ /g, '%s').replace(/[&;|`$]/g, '');
  return adbCommand(`shell input text "${escaped}"`);
}

export async function launchApp(packageName: string): Promise<string> {
  const sanitized = packageName.replace(/[^a-zA-Z0-9_.]/g, '');
  return adbCommand(`shell monkey -p ${sanitized} -c android.intent.category.LAUNCHER 1`);
}

export async function getStatus(): Promise<{ connected: boolean; device: string | null; detail?: string }> {
  try {
    const result = await adbCommand('devices -l');
    const lines = result.split('\n').filter(l => l.trim() && !l.includes('List'));
    const connected = lines.some(l => l.includes('device') && !l.includes('offline') && !l.includes('unauthorized'));
    const offline = lines.some(l => l.includes('offline'));
    const unauthorized = lines.some(l => l.includes('unauthorized'));

    let detail = '';
    if (unauthorized) detail = 'Unauthorized — accept the prompt on your TV';
    else if (offline) detail = 'Device offline — check TV network';
    else if (!connected && connectedDevice) detail = 'Connection lost';

    return { connected, device: connectedDevice, detail };
  } catch {
    return { connected: false, device: null, detail: 'ADB not responding' };
  }
}
