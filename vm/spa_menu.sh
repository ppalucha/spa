#!/bin/sh
SPA_DIR=/usr/local/spa

red=`tput setaf 1`
green=`tput setaf 2`
reset=`tput sgr0`

startSPA() {
  echo "Starting SPA server. Point your browser to VM IP and port as reported by SPA."
  cd $SPA_DIR && ./spa.js
  echo
  echo "${red}Ooops, it looks like SPA crashed, press ENTER to return to menu${reset}"
  echo
  read i
}

startShell() {
  echo "Starting shell, use ${green}exit${reset} to return to menu"
  cd /root && bash
}

updateSPA() {
  echo "Pulling newest SPA version"
  cd $SPA_DIR && git pull
  echo "Done, press ENTER to continue"
  read i
}

while true; do
reset

echo
echo "  Welcome to ${green}SPA Virtual Machine!${reset}"
echo "  Here are your network interfaces:"
echo
ip -br -4 -o address

cat << EOF

  Make sure you have some interface accessible from your host machine,
  for example host-only network.

  Choose action:
   ${red}1${reset} Start SPA server (default)
   ${red}2${reset} Update SPA (requies internet connection)
   ${red}3${reset} Start root shell
   ${red}4${reset} Shutdown machine

EOF
echo -n '> '
read i;
case $i in
 	"")
		startSPA
		;;
	1)
		startSPA
		;;
	2)
		updateSPA
		;;
	3)
		startShell
		;;
	4)
		shutdown -f now
		;;
	*)	echo "${red}Invalid choice${reset}"
		sleep 2
		;;
esac

done
