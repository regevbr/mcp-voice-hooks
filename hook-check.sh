#!/bin/bash
response=$(curl -s -X POST localhost:3000/api/dequeue-utterances 2>/dev/null)
if [[ "$response" == *'"utterances":['* && "$response" != *'"utterances":[]'* ]]; then
    echo "dictated: $response" >&2
    exit 2
else
    echo "no utterances" >&1
    exit 0
fi
