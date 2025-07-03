#!/bin/bash
# Send reminder to stderr so it appears in Claude's context
echo "Use the 'say' command to respond to the user's voice input before proceeding." >&2
echo "Example: bash -c 'say -r 300 \"I understand your request. I'll start working on...\"'" >&2
# exit 2