#!/bin/bash

if [ ! -d "server" ]; then
    echo "'server' directory not found. Run this script from the signally root directory."
    exit 1
fi

if [ ! -d "server/node_modules" ]; then
    cd server
    npm install
    cd ..
fi

cd server
npm start
