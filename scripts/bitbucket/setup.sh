#!/bin/bash
set -euo pipefail

echo "🚀 Bitbucket CLI Setup"
echo "═══════════════════════"
echo ""

# Check if config.json exists
if [ -f "config.json" ]; then
    echo "✅ config.json file already exists"
else
    echo "📋 Creating config.json file from template..."
    cp config.json.example config.json
    echo "✅ config.json file created"
fi

echo ""
echo "📝 Next steps:"
echo "1. Edit config.json with your Bitbucket credentials:"
echo "   - Username: Find at https://bitbucket.org/account/settings/"
echo "   - App Password: Create at https://bitbucket.org/account/settings/app-passwords/"
echo ""
echo "2. Test the setup:"
echo "   bun repos:list -l 5"
echo ""
echo "3. Create your first PR:"
echo "   bun pr:create"
echo ""
echo "Happy coding! 🎉"