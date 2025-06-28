import { Command } from 'commander';
import { upload } from '@/operations/upload';
import type { NetStorageClientContext } from '@/index';

export default function uploadCommand(ctx: NetStorageClientContext): Command {
  const command = new Command('upload');
  command
    .argument('<localPath>', 'Path to local file')
    .argument('<remotePath>', 'Remote NetStorage path')
    .description('Upload a file to NetStorage')
    .action(async (localPath, remotePath) => {
      await upload(ctx, { fromLocal: localPath, toRemote: remotePath });
    });
  return command;
}
