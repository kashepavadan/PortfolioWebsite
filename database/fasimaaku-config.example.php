<?php
// Copy this file to your HOME folder on HostGator, OUTSIDE public_html, named exactly:
//     /home/<your-cpanel-username>/fasimaaku-config.php
// Then fill in the values below. Never commit the filled-in copy to GitHub.

return [
    // From cPanel → MySQL Databases. HostGator prefixes names with your cPanel username.
    'db_host' => 'localhost',
    'db_name' => 'cpaneluser_fasimaaku',
    'db_user' => 'cpaneluser_fasedit',
    'db_pass' => 'the database user password',

    // The password you type on the page to edit. At least 10 characters; make it long.
    'editor_password' => 'change-me',

    // Keep this true on the live site: sign-in only works over https://.
    'require_https' => true,
];
