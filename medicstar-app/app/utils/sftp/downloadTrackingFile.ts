import SftpClient from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as path from 'path';
import { trackNumbersLogger } from '../../../lib/logger';

const DOWNLOADS_FOLDER = "downloads";

interface SftpConfig {
  host: string;
  username: string;
  password: string;
  port: number;
  remoteDir: string;
}

const getSftpConfig = (): SftpConfig => {
  const host = process.env.TRACKING_SFTP_HOST;
  const username = process.env.TRACKING_SFTP_USERNAME;
  const password = process.env.TRACKING_SFTP_PASSWORD;
  const port = parseInt(process.env.TRACKING_SFTP_PORT || '22');
  const remoteDir = process.env.TRACKING_SFTP_REMOTE_DIR || 'PROD/out';

  if (!host || !username || !password) {
    throw new Error('SFTP configuration missing. Please set SFTP_HOST, SFTP_USERNAME, and SFTP_PASSWORD environment variables.');
  }

  return { host, username, password, port, remoteDir };
};

const findLatestRaufFile = (files: any[]): string | null => {
  const raufFiles = files.filter(file =>
    file.name.startsWith('RAUF') &&
    file.name.toLowerCase().endsWith('.csv')
  );

  if (raufFiles.length === 0) {
    return null;
  }

  raufFiles.sort((a, b) => new Date(b.modifyTime).getTime() - new Date(a.modifyTime).getTime());

  return raufFiles[0].name;
};

export const downloadTrackingFileFromSftp = async (): Promise<string> => {
  const config = getSftpConfig();
  const sftp = new SftpClient();

  trackNumbersLogger.info('Connecting to SFTP server', {
    host: config.host,
    port: config.port,
    remoteDir: config.remoteDir
  });

  try {
    await sftp.connect({
      host: config.host,
      username: config.username,
      password: config.password,
      port: config.port
    });

    trackNumbersLogger.info('Connected to SFTP server successfully');

    const files = await sftp.list(config.remoteDir);

    trackNumbersLogger.info('Listed files from SFTP directory', {
      remoteDir: config.remoteDir,
      fileCount: files.length
    });

    const latestRaufFile = findLatestRaufFile(files);

    if (!latestRaufFile) {
      throw new Error(`No file starting with 'RAUF' and ending with '.csv' found in ${config.remoteDir}`);
    }

    trackNumbersLogger.info('Found latest RAUF file', {
      fileName: latestRaufFile,
      remoteDir: config.remoteDir
    });

    if (!fs.existsSync(DOWNLOADS_FOLDER)) {
      fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
    }

    const localFilePath = path.join(DOWNLOADS_FOLDER, latestRaufFile);
    const remoteFilePath = path.posix.join(config.remoteDir, latestRaufFile);

    trackNumbersLogger.info('Starting file download from SFTP', {
      remoteFilePath,
      localFilePath
    });

    await sftp.fastGet(remoteFilePath, localFilePath);

    const stats = fs.statSync(localFilePath);

    trackNumbersLogger.info('File downloaded successfully from SFTP', {
      fileName: latestRaufFile,
      localFilePath,
      fileSize: stats.size,
      remoteFilePath
    });

    return localFilePath;

  } catch (error) {
    trackNumbersLogger.error('SFTP download failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      host: config.host,
      remoteDir: config.remoteDir
    });
    throw error;
  } finally {
    try {
      await sftp.end();
      trackNumbersLogger.info('SFTP connection closed');
    } catch (closeError) {
      trackNumbersLogger.warn('Error closing SFTP connection', {
        error: closeError instanceof Error ? closeError.message : 'Unknown error'
      });
    }
  }
};
