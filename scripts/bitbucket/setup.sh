#!/bin/bash
set -euo pipefail

echo "🚀 Bitbucket CLI Setup"
echo "═══════════════════════"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "✅ .env file already exists"
else
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
fi

echo ""
echo "📝 Next steps:"
echo "1. Edit .env with your Bitbucket credentials:"
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