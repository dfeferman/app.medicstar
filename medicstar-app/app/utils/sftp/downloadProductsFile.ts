import SftpClient from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as path from 'path';
import { syncProductsLogger } from '../../../lib/logger';

const DOWNLOADS_FOLDER = "downloads";

interface SftpConfig {
  host: string;
  username: string;
  password: string;
  port: number;
  remoteDir: string;
}

const getSftpConfig = (): SftpConfig => {
  const host = process.env.PRODUCTS_SFTP_HOST;
  const username = process.env.PRODUCTS_SFTP_USERNAME;
  const password = process.env.PRODUCTS_SFTP_PASSWORD;
  const port = parseInt(process.env.PRODUCTS_SFTP_PORT || '22');
  const remoteDir = process.env.PRODUCTS_SFTP_REMOTE_DIR || '/www/transfer/update/out';

  if (!host || !username || !password) {
    throw new Error('Products SFTP configuration missing. Please set PRODUCTS_SFTP_HOST, PRODUCTS_SFTP_USERNAME, and PRODUCTS_SFTP_PASSWORD environment variables.');
  }

  return { host, username, password, port, remoteDir };
};

const findLatestXlsxFile = (files: any[]): string | null => {
  const xlsxFiles = files.filter(file =>
    file.name.toLowerCase().endsWith('.xlsx')
  );

  if (xlsxFiles.length === 0) {
    return null;
  }

  xlsxFiles.sort((a, b) => new Date(b.modifyTime).getTime() - new Date(a.modifyTime).getTime());

  return xlsxFiles[0].name;
};


export const downloadProductsFileFromSftp = async (): Promise<string> => {
  const config = getSftpConfig();
  const sftp = new SftpClient();

  syncProductsLogger.info('Connecting to products SFTP server', {
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

    syncProductsLogger.info('Connected to products SFTP server successfully');

    const dirExists = await sftp.exists(config.remoteDir);
    if (!dirExists) {
      throw new Error(`Remote directory does not exist: ${config.remoteDir}`);
    }

    const files = await sftp.list(config.remoteDir);

    syncProductsLogger.info('Listed files from products SFTP directory', {
      remoteDir: config.remoteDir,
      fileCount: files.length
    });

    const latestXlsxFile = findLatestXlsxFile(files);

    if (!latestXlsxFile) {
      throw new Error(`No .xlsx file found in ${config.remoteDir}`);
    }

    syncProductsLogger.info('Found latest XLSX file', {
      fileName: latestXlsxFile,
      remoteDir: config.remoteDir
    });

    if (!fs.existsSync(DOWNLOADS_FOLDER)) {
      fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
    }

    const localFilePath = path.join(DOWNLOADS_FOLDER, latestXlsxFile);
    const remoteFilePath = path.posix.join(config.remoteDir, latestXlsxFile);

    syncProductsLogger.info('Starting file download from products SFTP', {
      remoteFilePath,
      localFilePath
    });

    await sftp.fastGet(remoteFilePath, localFilePath);

    const stats = fs.statSync(localFilePath);

    syncProductsLogger.info('Products file downloaded successfully from SFTP', {
      fileName: latestXlsxFile,
      localFilePath,
      fileSize: stats.size,
      remoteFilePath
    });

    return localFilePath;

  } catch (error) {
    syncProductsLogger.error('Products SFTP download failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      host: config.host,
      remoteDir: config.remoteDir
    });
    throw error;
  } finally {
    try {
      await sftp.end();
      syncProductsLogger.info('Products SFTP connection closed');
    } catch (closeError) {
      syncProductsLogger.warn('Error closing products SFTP connection', {
        error: closeError instanceof Error ? closeError.message : 'Unknown error'
      });
    }
  }
};
