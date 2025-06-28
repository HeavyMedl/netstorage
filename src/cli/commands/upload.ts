import { Command } from 'commander';
import { upload } from '@/operations/upload';
import { loadClientConfig } from '../utils/loadConfig';

export default function uploadCommand(): Command {
  const command = new Command('upload');

  command
    .argument('<localPath>', 'Path to local file')
    .argument('<remotePath>', 'Remote NetStorage path')
    .description('Upload a file to NetStorage')
    .action(async (localPath, remotePath) => {
      const config = await loadClientConfig();
      await upload(config, { fromLocal: localPath, toRemote: remotePath });
    });

  return command;
}
