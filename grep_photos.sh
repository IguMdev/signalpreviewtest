grep -a -o "https://lh3.googleusercontent.com/[a-zA-Z0-9_-]*" /var/www/wordpress/db_data/wp_options.ibd | sort | uniq
