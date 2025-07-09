#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { replaceVoiceHooks, areHooksEqual, removeVoiceHooks } from '../dist/hook-merger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main entry point for npx mcp-voice-hooks
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'install-hooks') {
      console.log('🔧 Installing MCP Voice Hooks...');

      // Configure Claude Code settings automatically
      await configureClaudeCodeSettings();

      console.log('\n✅ Installation complete!');
      console.log('📝 To add the server to Claude Code, run: `claude mcp add voice-hooks npx mcp-voice-hooks`');
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

  // Add hook configuration with inline commands
  const hookConfig = {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST \"http://localhost:${MCP_VOICE_HOOKS_PORT:-5111}/api/hooks/stop\" || echo '{\"decision\": \"approve\", \"reason\": \"voice-hooks unavailable\"}'"
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
            "command": "curl -s -X POST \"http://localhost:${MCP_VOICE_HOOKS_PORT:-5111}/api/hooks/pre-tool\" || echo '{\"decision\": \"approve\", \"reason\": \"voice-hooks unavailable\"}'"
          }
        ]
      },
      {
        "matcher": "^mcp__voice-hooks__speak$",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST \"http://localhost:${MCP_VOICE_HOOKS_PORT:-5111}/api/hooks/pre-speak\" || echo '{\"decision\": \"approve\", \"reason\": \"voice-hooks unavailable\"}'"
          }
        ]
      },
      {
        "matcher": "^mcp__voice-hooks__wait_for_utterance$",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST \"http://localhost:${MCP_VOICE_HOOKS_PORT:-5111}/api/hooks/pre-wait\" || echo '{\"decision\": \"approve\", \"reason\": \"voice-hooks unavailable\"}'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST \"http://localhost:${MCP_VOICE_HOOKS_PORT:-5111}/api/hooks/post-tool\" || echo '{}'"
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
  try {
    console.log('🔄 Updating hooks to latest version...');

    // Update hooks configuration in settings.json
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
  const claudeSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');

  // Remove voice hooks from Claude settings
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