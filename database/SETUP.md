# Fasimāķu dictionary: database setup on HostGator

The Fasimāķu Toolbox page (`fasimaaku.html`) reads its words from a MySQL database
through a small PHP file (`api/fasimaaku.php`). Anyone can browse the dictionary.
Only someone who knows your editor password can add, edit or delete words.

Everything below happens in **cPanel**. It takes about 15 minutes, and you only do it once.

## 1. Make sure the site uses HTTPS

Your password must never travel unencrypted, so signing in only works over `https://`.

1. In cPanel, open **SSL/TLS Status**.
2. If `daniel.kashepava.com` doesn't have a valid certificate, select it and click **Run AutoSSL**.
   HostGator includes this for free.
3. Check that `https://daniel.kashepava.com` loads with a padlock.

## 2. Check the PHP version

1. Open **MultiPHP Manager**.
2. Find your domain and make sure it uses **PHP 7.4 or newer** (8.1+ is best). Change it if not.

## 3. Create the database

1. Open **MySQL Database Wizard**.
2. **Database name:** `fasimaaku`. HostGator adds your cPanel username in front, so the full
   name will be something like `abc123_fasimaaku`. **Write down the full name.**
3. **Username:** `fasedit`, which becomes something like `abc123_fasedit`. Use the **Password
   Generator** for the password. **Write down the full username and that password.**
4. Tick **ALL PRIVILEGES**, then click **Next Step**.

## 4. Create the tables and import the words

1. Open **phpMyAdmin** and click your new database in the left sidebar.
2. Click the **SQL** tab, paste the contents of `database/schema.sql`, and click **Go**.
3. Click the **SQL** tab again, paste the contents of `database/seed.sql`, and click **Go**.
   Run this one only once. (If pasting is awkward, use the **Import** tab, choose
   `seed.sql`, and leave the character set as `utf-8`.)
4. Click the `fas_words` table. It should show **360** rows.

## 5. Create the config file (outside your public folder)

This file holds the database login and your editor password. It must **not** go inside
`public_html`. The API refuses to run if it's there.

1. Open **File Manager**. It starts in your home folder, the one that *contains*
   `public_html`. Don't go into `public_html`.
2. Click **+ File** and name it exactly `fasimaaku-config.php`.
3. Right-click it, choose **Edit**, and paste in the contents of
   `database/fasimaaku-config.example.php`.
4. Fill in your values:
   - `db_name`, `db_user`, `db_pass`: the full names and password from step 3. Leave
     `db_host` as `localhost`.
   - `editor_password`: the password you'll type to edit. Use at least 10 characters.
     A short phrase like `three purple lanterns sing` is long and easy to remember.
5. Save. Then right-click the file, choose **Change Permissions**, and set it to **600**
   (only Owner Read and Write ticked).

Never commit your filled-in copy to GitHub. The repo's `.gitignore` blocks it just in case.

## 6. Upload the site files

Upload these the same way you normally update your site, keeping the folder structure:

```
fasimaaku.html
projects.html
css/fasimaaku.css
js/fasimaaku.js
api/fasimaaku.php
data/dictionary.txt     ← read-only backup copy, used if the database is ever unreachable
```

The `database/` folder doesn't need to be uploaded. If it is, its `.htaccess` blocks web access.

## 7. Test it

1. Open `https://daniel.kashepava.com/api/fasimaaku.php?action=words`. You should see a page
   of text starting with `{"words":[{"id":1,"fas":"bīlauliñ"…`. If you see an error
   message instead, check the table below.
2. Open `https://daniel.kashepava.com/fasimaaku.html`. The dictionary should work as before.
3. Open `https://daniel.kashepava.com/fasimaaku.html?edit=1`, type your editor password,
   and click **Sign in**.

## Editing

- To edit, go to `fasimaaku.html?edit=1` and sign in. You stay signed in until you click
  **Sign out**, close the browser, or leave it idle for 2 hours.
- Type Fasimāķu in plain ASCII if you like (`aa` becomes ā, `sh` becomes š, `k'` becomes ķ…).
  It's converted when you save.
- **Delete** also removes every word built from that word, as the original app did. It lists
  them and asks you first.
- **Download backup** saves the whole dictionary as `dictionary.txt`. Upload that file over
  `data/dictionary.txt` now and then, so the fallback copy stays fresh.
- **Change your password** by editing `editor_password` in `fasimaaku-config.php`.

**Security:** after 5 wrong passwords from one address, signing in is locked for 15 minutes.
It also locks after 30 wrong passwords from all addresses combined, which stops spread-out
guessing. If you lock yourself out, either wait, or in phpMyAdmin open `fas_login_attempts`
and click **Empty** (under Operations).

**Backups:** besides **Download backup**, phpMyAdmin → your database → **Export** → **Go**
downloads a full SQL backup that can be re-imported.

## Troubleshooting

| What you see | What to do |
|---|---|
| `fasimaaku-config.php was not found` | The file is missing, misnamed, or not in your home folder (step 5). |
| `move fasimaaku-config.php out of your public web folder` | It's inside `public_html`. Move it up one level, to the folder that contains `public_html`. |
| `Could not connect to the database` | Check `db_name`, `db_user` and `db_pass`. Use the *full* names with the `abc123_` prefix. Also make sure the user has privileges on the database (step 3.4). |
| `choose an editor_password of at least 10 characters` | Set a longer `editor_password`. The placeholder `change-me` isn't accepted. |
| `signing in only works over https://` | Open the page with `https://`, or set up SSL (step 1). |
| `Too many wrong passwords` | Wait 15 minutes, or empty `fas_login_attempts` in phpMyAdmin. |
| The page shows words, but `?edit=1` says editing is unavailable | The page is using `data/dictionary.txt` because the API failed. Open the API link from step 7.1 to see why. |
| A blank page or a download instead of text at the API link | PHP isn't running for that file. Check step 2, and that `api/fasimaaku.php` was uploaded as-is. |
