#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

// Main entry point for npx mcp-voice-hooks
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === '--version' || command === '-v') {
      // Read package.json to get version
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      console.log(packageJson.version);
    } else {
      // Default behavior: run the MCP server
      console.log('🔊 MCP TTS Server - Starting...');
      await runMCPServer();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// STT (whisper-typer-tool) management
const STT_DIR = path.join(os.homedir(), '.mcp-voice-hooks', 'whisper-typer-tool');
const STT_REPO = 'https://github.com/regevbr/whisper-typer-tool.git';

// Check if whisper-typer-tool is installed
function isSTTInstalled() {
  return fs.existsSync(STT_DIR) && fs.existsSync(path.join(STT_DIR, 'whisper-typer-server.py'));
}

// Install or update whisper-typer-tool
async function setupSTT() {
  try {
    if (isSTTInstalled()) {
      console.log('🔄 Updating whisper-typer-tool...');
      await execAsync('git pull', { cwd: STT_DIR });
      console.log('✅ Updated whisper-typer-tool');
    } else {
      console.log('📥 Installing whisper-typer-tool...');
      const sttParentDir = path.dirname(STT_DIR);
      if (!fs.existsSync(sttParentDir)) {
        fs.mkdirSync(sttParentDir, { recursive: true });
      }
      await execAsync(`git clone ${STT_REPO} "${STT_DIR}"`);
      console.log('✅ Cloned whisper-typer-tool');
    }

    // Install Python dependencies
    console.log('📦 Installing Python dependencies...');
    const requirementsPath = path.join(STT_DIR, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      try {
        // Try uv first, fallback to pip
        await execAsync(`uv add -r requirements.txt`, { cwd: STT_DIR });
        console.log('✅ Installed dependencies with uv');
      } catch (uvError) {
        await execAsync(`pip install -r requirements.txt`, { cwd: STT_DIR });
        console.log('✅ Installed dependencies with pip');
      }
    }
  } catch (error) {
    console.warn('⚠️  Failed to setup STT:', error.message);
    console.log('📝 STT setup failed. Voice input will not be available.');
    console.log('💡 Requirements: Python 3, FFmpeg, PortAudio');
  }
}

// Start whisper-typer-tool server
function startSTTServer() {
  if (!isSTTInstalled()) {
    return null;
  }

  try {
    const sttChild = spawn('python', ['whisper-typer-server.py'], {
      cwd: STT_DIR,
      stdio: ['ignore', 'ignore', 'pipe'], // Allow stderr for error handling
      detached: false // Keep attached for better process management
    });

    // Handle STT server errors
    sttChild.stderr?.on('data', (data) => {
      console.warn('⚠️  STT server warning:', data.toString().trim());
    });

    sttChild.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.warn(`⚠️  STT server exited with code ${code}`);
      }
    });

    console.log('🎤 Started whisper-typer-tool server (PID:', sttChild.pid + ')');
    return sttChild;
  } catch (error) {
    console.warn('⚠️  Failed to start STT server:', error.message);
    return null;
  }
}

// Run the MCP server
async function runMCPServer() {
  // Setup STT first
  await setupSTT();

  // Start STT server
  const sttChild = startSTTServer();

  const serverPath = path.join(__dirname, '..', 'dist', 'unified-server.js');

  // Run the compiled JavaScript server
  const child = spawn('node', [serverPath, '--mcp-managed'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    detached: false // Keep attached for proper cleanup
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start MCP server:', error.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    console.log(`🔄 MCP server exited with code ${code}`);
    process.exit(code);
  });

  // Handle graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n🛑 Shutting down (${signal})...`);
    
    // Kill STT server first
    if (sttChild && !sttChild.killed) {
      console.log('🔄 Stopping STT server...');
      sttChild.kill(signal);
      
      // Force kill STT after timeout
      setTimeout(() => {
        if (!sttChild.killed) {
          console.log('⚠️  Force killing STT server...');
          sttChild.kill('SIGKILL');
        }
      }, 2000);
    }
    
    // Kill main server
    if (!child.killed) {
      console.log('🔄 Stopping MCP server...');
      child.kill(signal);
      
      // Force kill main server after timeout
      setTimeout(() => {
        if (!child.killed) {
          console.log('⚠️  Force killing MCP server...');
          child.kill('SIGKILL');
        }
      }, 2000);
    }
    
    // Exit after giving processes time to clean up
    setTimeout(() => {
      console.log('✅ Shutdown complete');
      process.exit(0);
    }, 3000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('exit', () => {
    // Last resort cleanup
    if (sttChild && !sttChild.killed) {
      sttChild.kill('SIGKILL');
    }
    if (child && !child.killed) {
      child.kill('SIGKILL');
    }
  });
}

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
