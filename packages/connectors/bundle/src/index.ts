import { registerFilesystemConnector } from '@jak-shield/connector-filesystem';
import { registerShellConnector } from '@jak-shield/connector-shell';
import { registerGmailConnector } from '@jak-shield/connector-gmail';
import { registerGithubConnector } from '@jak-shield/connector-github';
import { registerSupabaseConnector } from '@jak-shield/connector-supabase';
import { registerPostgresConnector } from '@jak-shield/connector-postgres';
import { registerBrowserConnector } from '@jak-shield/connector-browser';
import { registerHttpConnector } from '@jak-shield/connector-http';
import { registerSlackConnector } from '@jak-shield/connector-slack';
import { registerSmsConnector } from '@jak-shield/connector-sms';
import { registerGDriveConnector } from '@jak-shield/connector-gdrive';
import { registerWebhookConnector } from '@jak-shield/connector-webhook';
import { registerSocialConnector } from '@jak-shield/connector-social';

export function registerAllConnectors(): void {
  registerFilesystemConnector();
  registerShellConnector();
  registerGmailConnector();
  registerGithubConnector();
  registerSupabaseConnector();
  registerPostgresConnector();
  registerBrowserConnector();
  registerHttpConnector();
  registerSlackConnector();
  registerSmsConnector();
  registerGDriveConnector();
  registerWebhookConnector();
  registerSocialConnector();
}
