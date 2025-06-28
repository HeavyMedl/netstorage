import { Command } from 'commander';
import { upload } from '@/operations/upload';
import type { NetStorageClientConfig } from '@/index';

export default function uploadCommand(config: NetStorageClientConfig): Command {
  const command = new Command('upload');
  command
    .argument('<localPath>', 'Path to local file')
    .argument('<remotePath>', 'Remote NetStorage path')
    .description('Upload a file to NetStorage')
    .action(async (localPath, remotePath) => {
      await upload(config, { fromLocal: localPath, toRemote: remotePath });
    });
  return command;
}
