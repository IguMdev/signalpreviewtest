cd /var/www/wordpress
docker compose up -d
sleep 10
docker compose exec -T db mysql -u wordpress -pwordpress wordpress -e "SELECT option_name, option_value FROM wp_options WHERE option_name LIKE '%trustindex%';" > /tmp/ti_options.txt
