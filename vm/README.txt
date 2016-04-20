These are the config files and scripts for creating a self contained virtual machine
running SPA.

Short description of preparing VM:

- I used veewee to prepare Debian VirtualBox machine as described at https://wiki.debian.org/Veewee

- You need to install git, nodejs, npm and mongodb as described in SPA help, clone SPA repository
and install required npm modules. SPA source code has been put at /usr/local/spa.

- My version of Debian uses "predictible network interface names":
https://www.freedesktop.org/wiki/Software/systemd/PredictableNetworkInterfaceNames/
As I'm not sure what interfaces will VirtualBox create, I added multiple sections like these in
/etc/network/interfaces for interfaces from enp0s0 to enp1s9:

allow hotplug enp0s0
iface enp0s0 inet dhcp

- I prepared script for start menu, spa_menu.sh - included in this directory.

- Script installation as systemd service requires creating file /etc/systemd/system/spa.service - see
example.

- Installation of service via command:

# systemctl enable spa.service

- Also, you need to disable getty on first console with command:

# systemctl disable getty@tty1.service

- If you change service definition, you need to reload it with:

# systemctl daemon-reload

- 
