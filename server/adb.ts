import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let connectedDevice: string | null = null;

export async function adbCommand(args: string): Promise<string> {
  const { stdout, stderr } = await execAsync(`adb ${args}`, { timeout: 10000 });
  if (stderr && !stderr.includes('Warning')) throw new Error(stderr);
  return stdout.trim();
}

export async function connect(ip: string): Promise<string> {
  const result = await adbCommand(`connect ${ip}:5555`);
  if (result.includes('connected')) {
    connectedDevice = ip;
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

export async function getStatus(): Promise<{ connected: boolean; device: string | null }> {
  try {
    const result = await adbCommand('devices');
    const devices = result.split('\n').filter(l => l.includes('device') && !l.includes('List'));
    return { connected: devices.length > 0, device: connectedDevice };
  } catch {
    return { connected: false, device: null };
  }
}
