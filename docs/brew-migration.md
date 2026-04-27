## Migrating Homebrew from Intel to M1

## You can copy and paste into the Terminal

## Go to home directory
cd;

## Create list of installed Intel packages
brew bundle dump;

## Install new version of Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)";

## Update the PATH to point to M1 version first
eval "$(/opt/homebrew/bin/brew shellenv)" ;
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc;

## Migrate Intel packages (/usr/local/bin/brew) to M1 (/opt/Homebrew)
## You may need to enter your sysadmin password
brew bundle --file Brewfile;

## Update packages
brew update; 

## Upgrade packages
brew upgrade;

## Clean up
brew cleanup;

## Uninstall old Intel version

# Download uninstall script
curl -fsSL -o ./uninstall.sh https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh;

# Run the uninstall specifying the old path
sudo /bin/bash ./uninstall.sh --path=/usr/local;
# Enter password
# Type Y to uninstall

# Delete uninstall script
rm uninstall.sh;

# Final cleanup
brew cleanup;
