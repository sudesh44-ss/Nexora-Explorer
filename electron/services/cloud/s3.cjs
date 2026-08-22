"use strict";

const { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const secureCredentials = require("./secureCredentials.cjs");
const fs = require("fs");
const path = require("path");

class S3Adapter {
  constructor(providerId = "s3") {
    this.providerId = providerId; // "s3" or "s3-compatible"
  }

  async getCredentials() {
    const prefix = this.providerId.toUpperCase();
    const region = secureCredentials.getCredential(`${prefix}_REGION`) || "us-east-1";
    const endpoint = secureCredentials.getCredential(`${prefix}_ENDPOINT`);
    const accessKey = secureCredentials.getCredential(`${prefix}_ACCESS_KEY`);
    const secretKey = secureCredentials.getCredential(`${prefix}_SECRET_KEY`);
    const bucket = secureCredentials.getCredential(`${prefix}_BUCKET`);

    if (!accessKey || !secretKey || !bucket) return null;

    return { region, endpoint, accessKey, secretKey, bucket };
  }

  async getClient() {
    const creds = await this.getCredentials();
    if (!creds) return null;

    if (creds.accessKey.startsWith("sandbox")) {
      return "sandbox";
    }

    return new S3Client({
      region: creds.region,
      endpoint: creds.endpoint || undefined,
      credentials: {
        accessKeyId: creds.accessKey,
        secretAccessKey: creds.secretKey
      },
      forcePathStyle: !!creds.endpoint
    });
  }

  async connect(config) {
    const prefix = this.providerId.toUpperCase();
    if (config.region) secureCredentials.setCredential(`${prefix}_REGION`, config.region);
    if (config.endpoint) secureCredentials.setCredential(`${prefix}_ENDPOINT`, config.endpoint);
    if (config.accessKey) secureCredentials.setCredential(`${prefix}_ACCESS_KEY`, config.accessKey);
    if (config.secretKey) secureCredentials.setCredential(`${prefix}_SECRET_KEY`, config.secretKey);
    if (config.bucket) secureCredentials.setCredential(`${prefix}_BUCKET`, config.bucket);
    return { success: true };
  }

  async disconnect() {
    const prefix = this.providerId.toUpperCase();
    secureCredentials.deleteCredential(`${prefix}_REGION`);
    secureCredentials.deleteCredential(`${prefix}_ENDPOINT`);
    secureCredentials.deleteCredential(`${prefix}_ACCESS_KEY`);
    secureCredentials.deleteCredential(`${prefix}_SECRET_KEY`);
    secureCredentials.deleteCredential(`${prefix}_BUCKET`);
    return { success: true };
  }

  async getStatus() {
    const creds = await this.getCredentials();
    if (!creds) return "Disconnected";
    return "Connected";
  }

  async list(remotePath = "") {
    const creds = await this.getCredentials();
    if (!creds) return { success: false, error: "Not configured" };

    const client = await this.getClient();
    if (client === "sandbox") {
      return this.listSandbox(remotePath);
    }

    try {
      const prefix = remotePath ? (remotePath.endsWith("/") ? remotePath : remotePath + "/") : "";
      
      const command = new ListObjectsV2Command({
        Bucket: creds.bucket,
        Prefix: prefix,
        Delimiter: "/"
      });

      const response = await client.send(command);
      
      const files = [];

      // Add folders from CommonPrefixes
      if (response.CommonPrefixes) {
        for (const item of response.CommonPrefixes) {
          const folderPath = item.Prefix;
          const cleanName = folderPath.slice(0, -1).split("/").pop();
          files.push({
            id: folderPath,
            name: cleanName,
            path: "/" + folderPath,
            relativePath: folderPath,
            type: "Folder",
            size: 0,
            modified: new Date().toISOString(),
            provider: this.providerId
          });
        }
      }

      // Add files from Contents
      if (response.Contents) {
        for (const item of response.Contents) {
          if (item.Key === prefix) continue; // Skip prefix directory placeholder
          
          const cleanName = item.Key.split("/").pop();
          files.push({
            id: item.Key,
            name: cleanName,
            path: "/" + item.Key,
            relativePath: item.Key,
            type: "File",
            size: item.Size || 0,
            modified: item.LastModified ? item.LastModified.toISOString() : new Date().toISOString(),
            provider: this.providerId
          });
        }
      }

      return { success: true, files };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async upload(localPath, remotePath) {
    const creds = await this.getCredentials();
    if (!creds) throw new Error("Not configured");

    const client = await this.getClient();
    if (client === "sandbox") {
      return this.uploadSandbox(localPath, remotePath);
    }

    const fileContent = fs.readFileSync(localPath);
    const command = new PutObjectCommand({
      Bucket: creds.bucket,
      Key: remotePath,
      Body: fileContent
    });

    await client.send(command);
    return { success: true };
  }

  async download(remotePath, localPath) {
    const creds = await this.getCredentials();
    if (!creds) throw new Error("Not configured");

    const client = await this.getClient();
    if (client === "sandbox") {
      return this.downloadSandbox(remotePath, localPath);
    }

    const command = new GetObjectCommand({
      Bucket: creds.bucket,
      Key: remotePath
    });

    const response = await client.send(command);
    const buffer = await response.Body.transformToByteArray();
    fs.writeFileSync(localPath, Buffer.from(buffer));
    return { success: true };
  }

  async delete(remotePath) {
    const creds = await this.getCredentials();
    if (!creds) throw new Error("Not configured");

    const client = await this.getClient();
    if (client === "sandbox") {
      return this.deleteSandbox(remotePath);
    }

    const command = new DeleteObjectCommand({
      Bucket: creds.bucket,
      Key: remotePath
    });

    await client.send(command);
    return { success: true };
  }

  async rename(remotePath, newName) {
    // S3 rename requires copy + delete
    const creds = await this.getCredentials();
    if (!creds) throw new Error("Not configured");

    const client = await this.getClient();
    if (client === "sandbox") {
      return this.renameSandbox(remotePath, newName);
    }

    const parentDir = path.dirname(remotePath).replace(/\\/g, "/");
    const toKey = parentDir === "." ? newName : parentDir + "/" + newName;

    // Copy
    const { CopyObjectCommand } = require("@aws-sdk/client-s3");
    await client.send(new CopyObjectCommand({
      Bucket: creds.bucket,
      CopySource: encodeURIComponent(`${creds.bucket}/${remotePath}`),
      Key: toKey
    }));

    // Delete
    await client.send(new DeleteObjectCommand({
      Bucket: creds.bucket,
      Key: remotePath
    }));

    return { success: true };
  }

  async createFolder(remotePath, folderName) {
    // S3 creates empty folder by uploading a 0-byte key with trailing slash
    const creds = await this.getCredentials();
    if (!creds) throw new Error("Not configured");

    const client = await this.getClient();
    if (client === "sandbox") {
      return this.createFolderSandbox(remotePath, folderName);
    }

    const prefix = remotePath ? (remotePath.endsWith("/") ? remotePath : remotePath + "/") : "";
    const key = `${prefix}${folderName}/`;

    const command = new PutObjectCommand({
      Bucket: creds.bucket,
      Key: key,
      Body: ""
    });

    await client.send(command);
    return { success: true };
  }

  async getMetadata(remotePath) {
    const creds = await this.getCredentials();
    if (!creds) return null;

    const client = await this.getClient();
    if (client === "sandbox") {
      const sandboxDir = this.getSandboxDir();
      const target = path.join(sandboxDir, remotePath);
      if (!fs.existsSync(target)) return null;
      const stat = fs.statSync(target);
      return {
        name: path.basename(target),
        path: remotePath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        type: stat.isDirectory() ? "Folder" : "File"
      };
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: creds.bucket,
        Key: remotePath
      });
      const response = await client.send(command);
      return {
        name: remotePath.split("/").pop(),
        path: remotePath,
        size: response.ContentLength || 0,
        modified: response.LastModified ? response.LastModified.toISOString() : new Date().toISOString(),
        type: "File"
      };
    } catch (e) {
      return null;
    }
  }

  // ----------------------------------------------------------
  // Sandbox fallbacks to allow testing without real credentials
  // ----------------------------------------------------------
  getSandboxDir() {
    const dir = path.join(appDataDir, "sandbox", this.providerId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  listSandbox(remotePath) {
    const sandboxDir = this.getSandboxDir();
    const targetDir = path.join(sandboxDir, remotePath);
    if (!fs.existsSync(targetDir)) return { success: true, files: [] };

    const items = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = items.map(item => {
      const fullPath = path.join(targetDir, item.name);
      const stat = fs.statSync(fullPath);
      return {
        id: item.name,
        name: item.name,
        path: "/" + path.relative(sandboxDir, fullPath).replace(/\\/g, "/"),
        relativePath: path.relative(sandboxDir, fullPath).replace(/\\/g, "/"),
        type: item.isDirectory() ? "Folder" : "File",
        size: item.isDirectory() ? 0 : stat.size,
        modified: stat.mtime.toISOString(),
        provider: this.providerId
      };
    });
    return { success: true, files };
  }

  uploadSandbox(localPath, remotePath) {
    const sandboxDir = this.getSandboxDir();
    const dest = path.join(sandboxDir, remotePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(localPath, dest);
    return { success: true };
  }

  downloadSandbox(remotePath, localPath) {
    const sandboxDir = this.getSandboxDir();
    const src = path.join(sandboxDir, remotePath);
    if (!fs.existsSync(src)) throw new Error("File not found in sandbox");
    fs.copyFileSync(src, localPath);
    return { success: true };
  }

  deleteSandbox(remotePath) {
    const sandboxDir = this.getSandboxDir();
    const src = path.join(sandboxDir, remotePath);
    if (fs.existsSync(src)) {
      if (fs.statSync(src).isDirectory()) {
        fs.rmSync(src, { recursive: true });
      } else {
        fs.unlinkSync(src);
      }
    }
    return { success: true };
  }

  renameSandbox(remotePath, newName) {
    const sandboxDir = this.getSandboxDir();
    const src = path.join(sandboxDir, remotePath);
    const dest = path.join(path.dirname(src), newName);
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
    }
    return { success: true };
  }

  createFolderSandbox(remotePath, folderName) {
    const sandboxDir = this.getSandboxDir();
    const dest = path.join(sandboxDir, remotePath, folderName);
    fs.mkdirSync(dest, { recursive: true });
    return { success: true };
  }
}

module.exports = S3Adapter;
