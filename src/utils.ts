import * as yaml from 'js-yaml';
export function readConfig(configPath: string): any {
  return yaml.safeLoad(configPath);
}