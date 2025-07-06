#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { replaceVoiceHooks, areHooksEqual } from '../dist/hook-merger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main entry point for npx mcp-voice-hooks
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'install-hooks') {
      console.log('🔧 Installing MCP Voice Hooks...');
      
      // Step 1: Ensure user directory exists and install/update hooks
      await ensureUserDirectorySetup();
      
      // Step 2: Configure Claude Code settings automatically
      await configureClaudeCodeSettings();
      
      console.log('\n✅ Installation complete!');
      console.log('📝 To start the server, run: npx mcp-voice-hooks');
    } else if (command === 'uninstall') {
      console.log('🗑️  Uninstalling MCP Voice Hooks...');
      await uninstall();
    } else {
      // Default behavior: ensure hooks are installed/updated, then run the MCP server
      console.log('🎤 MCP Voice Hooks - Starting server...');
      
      // Auto-install/update hooks on every startup
      await ensureHooksInstalled();
      
      console.log('');
      await runMCPServer();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ensure ~/.mcp-voice-hooks/hooks/ directory exists and contains latest hook files
async function ensureUserDirectorySetup() {
  const userDir = path.join(os.homedir(), '.mcp-voice-hooks');
  const hooksDir = path.join(userDir, 'hooks');
  
  console.log('📁 Setting up user directory:', userDir);
  
  // Clean up existing directory contents (except README.md if it exists)
  if (fs.existsSync(userDir)) {
    console.log('🧹 Cleaning up existing directory...');
    
    // Remove hooks directory if it exists
    if (fs.existsSync(hooksDir)) {
      fs.rmSync(hooksDir, { recursive: true, force: true });
      console.log('✅ Cleaned up old hooks');
    }
    
    // Remove any other files
    const files = fs.readdirSync(userDir);
    for (const file of files) {
      const filePath = path.join(userDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }
  
  // Create directories
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
    console.log('✅ Created user directory');
  }
  
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
    console.log('✅ Created hooks directory');
  }
  
  // Copy/update hook files from the package's .claude/hooks/ to user directory
  const packageHooksDir = path.join(__dirname, '..', '.claude', 'hooks');
  
  if (fs.existsSync(packageHooksDir)) {
    const hookFiles = fs.readdirSync(packageHooksDir).filter(file => file.endsWith('.sh'));
    
    for (const hookFile of hookFiles) {
      const sourcePath = path.join(packageHooksDir, hookFile);
      const destPath = path.join(hooksDir, hookFile);
      
      // Copy hook file
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Updated hook: ${hookFile}`);
    }
  } else {
    console.log('⚠️  Package hooks directory not found, skipping hook installation');
  }
  
  // Copy README.md from project root to user directory
  const projectReadmePath = path.join(__dirname, '..', 'README.md');
  const userReadmePath = path.join(userDir, 'README.md');
  
  if (fs.existsSync(projectReadmePath)) {
    fs.copyFileSync(projectReadmePath, userReadmePath);
    console.log('✅ Copied README.md');
  }
}

// Automatically configure Claude Code settings
async function configureClaudeCodeSettings() {
  const claudeDir = path.join(process.cwd(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  
  console.log('⚙️  Configuring project Claude Code settings...');
  
  // Create .claude directory if it doesn't exist
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
    console.log('✅ Created project .claude directory');
  }
  
  // Read existing settings or create new
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const settingsContent = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(settingsContent);
      console.log('📖 Read existing settings');
    } catch (error) {
      console.log('⚠️  Error reading existing settings, creating new');
      settings = {};
    }
  }
  
  // Add hook configuration
  const hookConfig = {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "sh ~/.mcp-voice-hooks/hooks/stop-hook.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "^(?!mcp__voice-hooks__).*",
        "hooks": [
          {
            "type": "command",
            "command": "sh ~/.mcp-voice-hooks/hooks/pre-tool-hook.sh"
          }
        ]
      },
      {
        "matcher": "^mcp__voice-hooks__speak$",
        "hooks": [
          {
            "type": "command",
            "command": "sh ~/.mcp-voice-hooks/hooks/pre-speak-hook.sh"
          }
        ]
      },
      {
        "matcher": "^mcp__voice-hooks__wait_for_utterance$",
        "hooks": [
          {
            "type": "command",
            "command": "sh ~/.mcp-voice-hooks/hooks/pre-wait-hook.sh"
          }
        ]
      }
    ]
  };
  
  // Replace voice hooks intelligently
  const updatedHooks = replaceVoiceHooks(settings.hooks || {}, hookConfig);
  
  // Check if hooks actually changed (ignoring order)
  if (areHooksEqual(settings.hooks || {}, updatedHooks)) {
    console.log('✅ Claude settings already up to date');
    return;
  }
  
  // Update settings with new hooks
  settings.hooks = updatedHooks;
  
  // Write settings back
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('✅ Updated project Claude Code settings');
}

// Silent hook installation check - runs on every startup
async function ensureHooksInstalled() {
  const userDir = path.join(os.homedir(), '.mcp-voice-hooks');
  const hooksDir = path.join(userDir, 'hooks');
  
  try {
    console.log('🔄 Updating hooks to latest version...');
    
    // Always remove and recreate the hooks directory to ensure clean state
    if (fs.existsSync(hooksDir)) {
      fs.rmSync(hooksDir, { recursive: true, force: true });
    }
    
    // Recreate with latest hooks
    await ensureUserDirectorySetup();
    await configureClaudeCodeSettings();
    console.log('✅ Hooks and settings updated');
  } catch (error) {
    // Silently continue if hooks can't be updated
    console.warn('⚠️  Could not auto-update hooks:', error.message);
  }
}

// Run the MCP server
async function runMCPServer() {
  const serverPath = path.join(__dirname, '..', 'dist', 'unified-server.js');
  
  // Run the compiled JavaScript server
  const child = spawn('node', [serverPath, '--mcp-managed'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
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
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    child.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    child.kill('SIGTERM');
  });
}

// Uninstall MCP Voice Hooks
async function uninstall() {
  const userDir = path.join(os.homedir(), '.mcp-voice-hooks');
  const claudeSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  
  // Step 1: Remove ~/.mcp-voice-hooks directory
  if (fs.existsSync(userDir)) {
    console.log('📁 Removing user directory:', userDir);
    fs.rmSync(userDir, { recursive: true, force: true });
    console.log('✅ Removed ~/.mcp-voice-hooks');
  } else {
    console.log('ℹ️  ~/.mcp-voice-hooks directory not found');
  }
  
  // Step 2: Remove voice hooks from Claude settings
  if (fs.existsSync(claudeSettingsPath)) {
    try {
      console.log('⚙️  Removing voice hooks from Claude settings...');
      
      const settingsContent = fs.readFileSync(claudeSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);
      
      if (settings.hooks) {
        // Remove voice hooks
        const cleanedHooks = removeVoiceHooks(settings.hooks);
        
        if (Object.keys(cleanedHooks).length === 0) {
          // If no hooks remain, remove the hooks property entirely
          delete settings.hooks;
        } else {
          settings.hooks = cleanedHooks;
        }
        
        // Write updated settings
        fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2));
        console.log('✅ Removed voice hooks from Claude settings');
      } else {
        console.log('ℹ️  No hooks found in Claude settings');
      }
    } catch (error) {
      console.log('⚠️  Could not update Claude settings:', error.message);
    }
  } else {
    console.log('ℹ️  No Claude settings file found in current project');
  }
  
  console.log('\n✅ Uninstallation complete!');
  console.log('👋 MCP Voice Hooks has been removed.');
}

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});