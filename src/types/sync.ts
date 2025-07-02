import type { NetStorageClientConfig, NetStorageFile } from '@/index';

/**
 * @constant {Readonly<Record<SyncDirection, string>>} SYNC_DIRECTION_ARROWS
 * Unicode arrows representing sync directions.
 */
export const SYNC_DIRECTION_ARROWS = {
  upload: '→',
  download: '←',
  both: '↔',
} as const;

/**
 * @typedef {'upload' | 'download' | 'both'} SyncDirection
 * The direction to sync files: upload to remote, download to local, or both.
 */
export type SyncDirection = 'upload' | 'download' | 'both';

/**
 * @typedef {'size' | 'mtime' | 'checksum' | 'exists'} CompareStrategy
 * Strategy used to compare files between local and remote.
 */
export type CompareStrategy = 'size' | 'mtime' | 'checksum' | 'exists';

/**
 * @typedef {'preferLocal' | 'preferRemote' | 'manual'} ConflictResolution
 * Method to resolve conflicts when syncing files.
 */
export type ConflictResolution = 'preferLocal' | 'preferRemote' | 'manual';

/**
 * @typedef {Record<string, 'upload' | 'download' | 'skip'>} ConflictRules
 * Mapping of file patterns to conflict resolution actions.
 */
export type ConflictRules = Record<string, 'upload' | 'download' | 'skip'>;

/**
 * @typedef {'remote' | 'local' | 'both' | 'none'} DeleteExtraneous
 * Specifies which extraneous files to delete during sync.
 */
export type DeleteExtraneous = 'remote' | 'local' | 'both' | 'none';

/**
 * @typedef {typeof SYNC_DIRECTION_ARROWS[keyof typeof SYNC_DIRECTION_ARROWS]} SyncArrow
 * Unicode arrow representing a sync direction.
 */
export type SyncArrow =
  (typeof SYNC_DIRECTION_ARROWS)[keyof typeof SYNC_DIRECTION_ARROWS];

/**
 * @typedef {'upload' | 'download' | 'skip' | undefined} ResolvedConflictAction
 * Action resolved for a conflicting file.
 */
export type ResolvedConflictAction = 'upload' | 'download' | 'skip' | undefined;

/**
 * @interface SyncTransferEvent
 * Event emitted when a file transfer occurs.
 * @property {'upload' | 'download'} direction - Direction of the transfer.
 * @property {string} localPath - Local file path involved in the transfer.
 * @property {string} remotePath - Remote file path involved in the transfer.
 */
export interface SyncTransferEvent {
  direction: SyncDirection;
  localPath: string;
  remotePath: string;
}

/**
 * @interface SyncSkipEvent
 * Event emitted when a file transfer is skipped.
 * @property {'upload' | 'download'} direction - Direction of the skipped transfer.
 * @property {string} localPath - Local file path skipped.
 * @property {string} remotePath - Remote file path skipped.
 * @property {string} reason - Reason why the transfer was skipped.
 */
export interface SyncSkipEvent {
  direction: SyncDirection;
  localPath: string;
  remotePath: string;
  reason: string;
}

/**
 * @interface SyncEventHandlers
 * Handlers for sync events.
 * @property {(params: SyncTransferEvent) => void} [onTransfer] - Called on file transfer.
 * @property {(params: SyncSkipEvent) => void} [onSkip] - Called when a transfer is skipped.
 * @property {(absPath: string) => void} [onDelete] - Called when a file is deleted.
 */
export interface SyncEventHandlers {
  onTransfer?: (params: SyncTransferEvent) => void;
  onSkip?: (params: SyncSkipEvent) => void;
  onDelete?: (absPath: string) => void;
}

/**
 * @interface BaseSyncParams
 * Base parameters for sync operations.
 * @extends SyncEventHandlers
 * @property {string} localPath - Local directory or file path.
 * @property {string} remotePath - Remote directory or file path.
 * @property {boolean} [dryRun] - If true, no actual changes are made.
 * @property {CompareStrategy} [compareStrategy] - Strategy to compare files.
 * @property {ConflictResolution} [conflictResolution] - Conflict resolution strategy.
 * @property {ConflictRules} [conflictRules] - Specific conflict rules.
 */
export interface BaseSyncParams extends SyncEventHandlers {
  localPath: string;
  remotePath: string;
  dryRun?: boolean;
  compareStrategy?: CompareStrategy;
  conflictResolution?: ConflictResolution;
  conflictRules?: ConflictRules;
}

/**
 * @interface SyncFileParams
 * Parameters for syncing a single file.
 * @extends BaseSyncParams
 * @property {SyncDirection} [syncDirection] - Direction to sync a single file.
 * @property {NetStorageFile} [remoteFileMeta] - Metadata of the remote file.
 * @property {DeleteExtraneous} [deleteExtraneous] - Whether to delete extraneous files.
 */
export interface SyncFileParams extends BaseSyncParams {
  syncDirection?: SyncDirection;
  remoteFileMeta?: NetStorageFile;
  deleteExtraneous?: DeleteExtraneous;
}

/**
 * @interface SyncDirectoryParams
 * Parameters for syncing directories.
 * @extends BaseSyncParams
 * @property {DeleteExtraneous} [deleteExtraneous] - Whether to delete extraneous files.
 * @property {SyncDirection} [syncDirection] - Direction to sync files.
 * @property {number} [maxConcurrency] - Maximum number of concurrent operations.
 */
export interface SyncDirectoryParams extends BaseSyncParams {
  deleteExtraneous?: DeleteExtraneous;
  syncDirection?: SyncDirection;
  maxConcurrency?: number;
}

/**
 * @interface TransferPermissionInput
 * Input parameters to determine if a file transfer is permitted.
 * @property {CompareStrategy} compareStrategy - Strategy used to compare files.
 * @property {SyncDirection} direction - Direction of transfer.
 * @property {'upload' | 'download' | 'skip' | undefined} action - Proposed action for the file.
 * @property {ConflictResolution} conflictResolution - Conflict resolution strategy.
 */
export interface TransferPermissionInput {
  compareStrategy: CompareStrategy;
  direction: SyncDirection;
  action: 'upload' | 'download' | 'skip' | undefined;
  conflictResolution: ConflictResolution;
}

/**
 * @interface SyncSingleEntryParams
 * Parameters for syncing a single file or directory entry.
 * @property {NetStorageClientconfig} config - Client config.
 * @property {SyncDirection} direction - Direction of sync.
 * @property {string} localPath - Local file path.
 * @property {string} remotePath - Remote file path.
 * @property {NetStorageFile} [remoteFileMeta] - Metadata of the remote file.
 * @property {boolean} dryRun - If true, no actual changes are made.
 * @property {CompareStrategy} compareStrategy - Strategy to compare files.
 * @property {ConflictRules} [conflictRules] - Specific conflict rules.
 * @property {ConflictResolution} conflictResolution - Conflict resolution strategy.
 * @property {(params: SyncTransferEvent) => void} [onTransfer] - Called on file transfer.
 * @property {(params: SyncSkipEvent) => void} [onSkip] - Called when a transfer is skipped.
 */
export interface SyncSingleEntryParams {
  config: NetStorageClientConfig;
  direction: SyncDirection;
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

/**
 * @interface DeleteExtraneousFilesParams
 * Parameters for deleting extraneous files during sync.
 * @property {NetStorageClientconfig} config - Client config.
 * @property {DeleteExtraneous} deleteExtraneous - Which extraneous files to delete.
 * @property {boolean} dryRun - If true, no actual deletions are made.
 * @property {string} localPath - Local directory path.
 * @property {string} remotePath - Remote directory path.
 * @property {Map<string, string>} [localFiles] - Map of local files.
 * @property {Map<string, NetStorageFile>} [remoteFiles] - Map of remote files.
 * @property {string[]} [localDirs] - List of local directories, used to remove empty directories before sync.
 * @property {string[]} [remoteDirs] - List of remote directories, used to remove empty directories before sync.
 * @property {boolean} [singleFile] - Indicates if operation is for a single file.
 * @property {(absPath: string) => void} [onDelete] - Called when a file is deleted.
 */
export interface DeleteExtraneousFilesParams {
  config: NetStorageClientConfig;
  deleteExtraneous: DeleteExtraneous;
  dryRun: boolean;
  localPath: string;
  remotePath: string;
  localFiles?: Map<string, string>;
  remoteFiles?: Map<string, NetStorageFile>;
  localDirs?: Map<string, string>;
  remoteDirs?: Map<string, NetStorageFile>;
  singleFile?: boolean;
  onDelete?: (absPath: string) => void;
}

/**
 * @interface ShouldTransferFileInput
 * Input parameters to decide if a file should be transferred.
 * @property {NetStorageClientconfig} config - Client config.
 * @property {SyncDirection} direction - Direction of transfer.
 * @property {string} localAbsPath - Absolute local file path.
 * @property {NetStorageFile} [remoteFile] - Metadata of the remote file.
 * @property {CompareStrategy} compareStrategy - Strategy to compare files.
 */
export interface ShouldTransferFileInput {
  config: NetStorageClientConfig;
  direction: SyncDirection;
  localAbsPath: string;
  remoteFile?: NetStorageFile;
  compareStrategy: CompareStrategy;
}

/**
 * @interface ResolveConflictActionInput
 * Input parameters for resolving conflict actions.
 * @property {string} relativePath - Relative file path.
 * @property {ConflictRules} [conflictRules] - Specific conflict rules.
 */
export interface ResolveConflictActionInput {
  relativePath: string;
  conflictRules?: ConflictRules;
}

/**
 * @interface FormatSyncDirectionLogInput
 * Input parameters for formatting sync direction logs.
 * @property {string} localPath - Local file path.
 * @property {string} remotePath - Remote file path.
 * @property {SyncDirection} syncDirection - Direction of sync.
 */
export interface FormatSyncDirectionLogInput {
  localPath: string;
  remotePath: string;
  syncDirection: SyncDirection;
}

/**
 * @interface SyncResult
 * Result of a sync operation.
 * @property {SyncTransferEvent[]} transferred - List of transferred files.
 * @property {SyncSkipEvent[]} skipped - List of skipped files.
 * @property {string[]} deleted - List of deleted file paths.
 */
export interface SyncResult {
  transferred: SyncTransferEvent[];
  skipped: SyncSkipEvent[];
  deleted: string[];
}

/**
 * @interface SyncResultAccumulator
 * Accumulator for sync results during processing.
 * @property {SyncTransferEvent[]} transferred - List of transferred files.
 * @property {SyncSkipEvent[]} skipped - List of skipped files.
 * @property {string[]} deleted - List of deleted file paths.
 */
export interface SyncResultAccumulator {
  transferred: SyncTransferEvent[];
  skipped: SyncSkipEvent[];
  deleted: string[];
}

/**
 * @interface SyncResultHandlers
 * Handlers for processing sync results.
 * @property {(event: SyncTransferEvent) => void} onTransfer - Called on file transfer.
 * @property {(event: SyncSkipEvent) => void} onSkip - Called when a transfer is skipped.
 * @property {(absPath: string) => void} onDelete - Called when a file is deleted.
 */
export interface SyncResultHandlers {
  onTransfer: (event: SyncTransferEvent) => void;
  onSkip: (event: SyncSkipEvent) => void;
  onDelete: (absPath: string) => void;
}
