import type { NetStorageClientContext } from '@/config/createClientContext';
import type { NetStorageFile } from '@/types/shared';

export type SyncDirection = 'upload' | 'download' | 'both';
export type CompareStrategy = 'size' | 'mtime' | 'checksum' | 'exists';
export type ConflictResolution = 'preferLocal' | 'preferRemote' | 'manual';
export type ConflictRules = Record<string, 'upload' | 'download' | 'skip'>;
export type DeleteExtraneous = 'remote' | 'local' | 'both' | 'none';

export interface SyncTransferEvent {
  direction: 'upload' | 'download';
  localPath: string;
  remotePath: string;
}

export interface SyncSkipEvent {
  direction: 'upload' | 'download';
  localPath: string;
  remotePath: string;
  reason: string;
}

export interface SyncEventHandlers {
  onTransfer?: (params: SyncTransferEvent) => void;
  onSkip?: (params: SyncSkipEvent) => void;
  onDelete?: (absPath: string) => void;
}

export interface BaseSyncParams extends SyncEventHandlers {
  localPath: string;
  remotePath: string;
  dryRun?: boolean;
  compareStrategy?: CompareStrategy;
  conflictResolution?: ConflictResolution;
  conflictRules?: ConflictRules;
}

export interface SyncFileParams extends BaseSyncParams {
  syncDirection?: Extract<SyncDirection, 'upload' | 'download'>;
  remoteFileMeta?: NetStorageFile;
  deleteExtraneous?: DeleteExtraneous;
}

export interface SyncDirectoryParams extends BaseSyncParams {
  deleteExtraneous?: DeleteExtraneous;
  syncDirection?: SyncDirection;
  maxConcurrency?: number;
}

export interface TransferPermissionInput {
  compareStrategy: CompareStrategy;
  direction: Extract<SyncDirection, 'upload' | 'download'>;
  action: 'upload' | 'download' | 'skip' | undefined;
  conflictResolution: ConflictResolution;
}

export interface SyncSingleEntryParams {
  ctx: NetStorageClientContext;
  direction: Extract<SyncDirection, 'upload' | 'download'>;
  localPath: string;
  remotePath: string;
  remoteFileMeta?: NetStorageFile;
  dryRun: boolean;
  compareStrategy: CompareStrategy;
  conflictRules?: ConflictRules;
  conflictResolution: ConflictResolution;
  onTransfer?: (params: SyncTransferEvent) => void;
  onSkip?: (params: SyncSkipEvent) => void;
}

export interface DeleteExtraneousFilesParams {
  ctx: NetStorageClientContext;
  deleteExtraneous: DeleteExtraneous;
  dryRun: boolean;
  localPath: string;
  remotePath: string;
  localFiles?: Map<string, string>;
  remoteFiles?: Map<string, NetStorageFile>;
  singleFile?: boolean;
  onDelete?: (absPath: string) => void;
}

export interface ShouldTransferFileInput {
  ctx: NetStorageClientContext;
  direction: Extract<SyncDirection, 'upload' | 'download'>;
  localAbsPath: string;
  remoteFile?: NetStorageFile;
  compareStrategy: CompareStrategy;
}

export interface ResolveConflictActionInput {
  relativePath: string;
  conflictRules?: ConflictRules;
}

export interface FormatSyncDirectionLogInput {
  localPath: string;
  remotePath: string;
  syncDirection: SyncDirection;
}

export const SYNC_DIRECTION_ARROWS = {
  upload: '→',
  download: '←',
  both: '↔',
} as const;

export type SyncArrow =
  (typeof SYNC_DIRECTION_ARROWS)[keyof typeof SYNC_DIRECTION_ARROWS];

export type ResolvedConflictAction = 'upload' | 'download' | 'skip' | undefined;

export interface SyncResult {
  transferred: SyncTransferEvent[];
  skipped: SyncSkipEvent[];
  deleted: string[];
}

export interface SyncResultAccumulator {
  transferred: SyncTransferEvent[];
  skipped: SyncSkipEvent[];
  deleted: string[];
}

export interface SyncResultHandlers {
  onTransfer: (event: SyncTransferEvent) => void;
  onSkip: (event: SyncSkipEvent) => void;
  onDelete: (absPath: string) => void;
}
