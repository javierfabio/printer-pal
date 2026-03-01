const SYSTEM_CONFIG_KEY = 'system_config';

export interface SystemConfig {
  systemName: string;
  copyrightText: string;
  developerText: string;
}

export function getSystemConfig(): SystemConfig {
  const raw = localStorage.getItem(SYSTEM_CONFIG_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fallthrough */ }
  }
  return {
    systemName: 'PrintControl',
    copyrightText: '© 2026 PrintControl. Todos los derechos reservados.',
    developerText: '',
  };
}

export function saveSystemConfig(config: SystemConfig) {
  localStorage.setItem(SYSTEM_CONFIG_KEY, JSON.stringify(config));
}
