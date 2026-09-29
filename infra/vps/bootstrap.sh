#!/usr/bin/env bash
# Подготовка чистого VPS (Ubuntu 24.04) под дашборды GENGROUP. Запуск от root:
#
#   curl -fsSL <raw-ссылка на этот файл> -o bootstrap.sh    # или scp с компьютера
#   DOMAIN=dash.example.ru LE_EMAIL=you@example.ru bash bootstrap.sh
#
# Скрипт идемпотентный: его можно запускать повторно, он доделает недостающее. Обычный порядок:
#   1-й запуск: ставит пакеты, заводит пользователя gg, печатает deploy-ключ и останавливается;
#   добавляешь ключ в GitHub (репозиторий -> Settings -> Deploy keys, БЕЗ права записи);
#   2-й запуск: клонирует репозиторий, выкатывает контур, nginx, сертификат, таймеры.
# Переменные:
#   DOMAIN      домен дашбордов (A-запись уже должна смотреть на IP сервера), напр. dash.genglass.ru
#   LE_EMAIL    почта для Let's Encrypt
#   REPO        git@github.com:oliverjone01-dev/t1.git (по умолчанию)
#   OPS_BRANCH  ветка, из которой берётся контур infra/vps (по умолчанию main)
set -euo pipefail

REPO=${REPO:-git@github.com:oliverjone01-dev/t1.git}
OPS_BRANCH=${OPS_BRANCH:-main}
DOMAIN=${DOMAIN:-}
LE_EMAIL=${LE_EMAIL:-}
GG_ROOT=/srv/gg
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "запускать от root"; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] || echo "ВНИМАНИЕ: скрипт проверен под Ubuntu 24.04, у тебя $PRETTY_NAME"

say "1. Пакеты и обновления безопасности"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git nginx certbot ufw fail2ban unattended-upgrades restic jq curl \
  ca-certificates apache2-utils rsync build-essential
dpkg-reconfigure -f noninteractive unattended-upgrades
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
timedatectl set-timezone UTC   # расписания задач записаны в UTC, как в GitHub cron
if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

say "2. Пользователь gg, папки, настройки"
id gg >/dev/null 2>&1 || useradd -m -s /bin/bash gg
install -d -o gg -g gg -m 0755 "$GG_ROOT"
install -d -o root -g gg -m 0750 /etc/gg
[ -f /etc/gg/gg.env ] || printf 'GG_ROOT=%s\nGG_OPS_BRANCH=%s\n' "$GG_ROOT" "$OPS_BRANCH" >/etc/gg/gg.env
if [ ! -f /etc/gg/secrets.env ]; then
  echo "# заполни по шаблону infra/vps/conf/secrets.env.example" >/etc/gg/secrets.env
fi
chown root:gg /etc/gg/secrets.env /etc/gg/gg.env
chmod 0640 /etc/gg/secrets.env /etc/gg/gg.env
echo 'gg ALL=(root) NOPASSWD: /usr/local/sbin/gg-apply-timers' >/etc/sudoers.d/gg
chmod 0440 /etc/sudoers.d/gg

say "3. Deploy-ключ для чтения репозитория"
GH=/home/gg/.ssh
install -d -o gg -g gg -m 0700 "$GH"
[ -f "$GH/github_deploy" ] || sudo -u gg ssh-keygen -q -t ed25519 -N '' -C "gg-vps-$(hostname -s)" -f "$GH/github_deploy"
grep -q 'Host github.com' "$GH/config" 2>/dev/null || sudo -u gg tee -a "$GH/config" >/dev/null <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
sudo -u gg sh -c "ssh-keyscan -t ed25519 github.com >> $GH/known_hosts 2>/dev/null; sort -u -o $GH/known_hosts $GH/known_hosts"
if ! sudo -u gg git ls-remote "$REPO" HEAD >/dev/null 2>&1; then
  echo
  echo "Добавь этот ключ в GitHub: репозиторий -> Settings -> Deploy keys -> Add deploy key"
  echo "(галочку «Allow write access» НЕ ставить), затем запусти bootstrap.sh ещё раз:"
  echo
  cat "$GH/github_deploy.pub"
  exit 0
fi

say "4. Зеркало репозитория, git данных, первый релиз контура"
if [ ! -d "$GG_ROOT/git/t1.git" ]; then
  sudo -u gg mkdir -p "$GG_ROOT/git"
  sudo -u gg git clone -q --bare "$REPO" "$GG_ROOT/git/t1.git"
fi
sudo -u gg git --git-dir="$GG_ROOT/git/t1.git" config remote.origin.fetch '+refs/heads/*:refs/heads/*'
sudo -u gg git --git-dir="$GG_ROOT/git/t1.git" fetch -q --prune origin
if [ ! -d "$GG_ROOT/data/.git" ]; then
  sudo -u gg mkdir -p "$GG_ROOT/data"
  sudo -u gg git -C "$GG_ROOT/data" init -q -b main
  sudo -u gg git -C "$GG_ROOT/data" -c user.name=gg-server -c user.email=gg-server@localhost \
    commit -q --allow-empty -m "данные сервера: начало истории"
fi
boot=$(mktemp -d)
git --git-dir="$GG_ROOT/git/t1.git" archive "refs/heads/$OPS_BRANCH" infra/vps | tar -x -C "$boot"
chmod -R a+rX "$boot"
sudo -u gg "$boot/infra/vps/bin/gg-release" "$OPS_BRANCH"
rm -rf "$boot"
OPS="$GG_ROOT/src/$(printf '%s' "$OPS_BRANCH" | sed 's#/#__#g')/current/infra/vps"
for t in gg-poll gg-job gg-release gg-site gg-status; do ln -sfn "$OPS/bin/$t" "/usr/local/bin/$t"; done
# root-скрипты - копией (из git сами не обновляются, см. шапку gg-apply-timers)
install -m 0755 "$OPS/sbin/gg-apply-timers" "$OPS/sbin/gg-backup" /usr/local/sbin/

say "5. systemd: выкат, задачи, бэкап"
install -m 0644 "$OPS"/systemd/*.service "$OPS"/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now gg-poll.timer
if grep -q '^RESTIC_REPOSITORY=.\+' /etc/gg/secrets.env; then
  systemctl enable --now gg-backup.timer
else
  echo "бэкап пока не включён: нет RESTIC_* в /etc/gg/secrets.env (после заполнения: systemctl enable --now gg-backup.timer)"
fi
# Таймеры задач включаются отдельной командой ПОСЛЕ заполнения секретов (шаг 5 в конце),
# иначе первая же задача упадёт без ключей. Дальше их обновляет gg-poll при правке jobs.conf.

say "6. nginx + HTTPS"
[ -f /etc/nginx/gg.htpasswd ] || { touch /etc/nginx/gg.htpasswd; chown root:www-data /etc/nginx/gg.htpasswd; chmod 0640 /etc/nginx/gg.htpasswd; }
rm -f /etc/nginx/sites-enabled/default
if [ -z "$DOMAIN" ]; then
  echo "DOMAIN не задан - nginx не настраиваю. Запусти повторно: DOMAIN=... LE_EMAIL=... bash bootstrap.sh"
else
  if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    printf 'server { listen 80; server_name %s; location /.well-known/acme-challenge/ { root /var/www/html; } location / { return 404; } }\n' "$DOMAIN" \
      >/etc/nginx/sites-available/gg-acme.conf
    ln -sfn /etc/nginx/sites-available/gg-acme.conf /etc/nginx/sites-enabled/gg.conf
    nginx -t && systemctl reload nginx
    certbot certonly -n --agree-tos --webroot -w /var/www/html -d "$DOMAIN" ${LE_EMAIL:+-m "$LE_EMAIL"} \
      || { echo "сертификат не получен: проверь, что A-запись $DOMAIN указывает на этот сервер"; exit 1; }
  fi
  sed -e "s#__DOMAIN__#$DOMAIN#g" -e "s#__GG_ROOT__#$GG_ROOT#g" "$OPS/nginx/gg.conf.template" \
    >/etc/nginx/sites-available/gg.conf
  ln -sfn /etc/nginx/sites-available/gg.conf /etc/nginx/sites-enabled/gg.conf
  rm -f /etc/nginx/sites-available/gg-acme.conf
  # nginx должен видеть www/current (gg:gg 0755 по умолчанию - читается)
  nginx -t && systemctl reload nginx
  # продление сертификата: certbot.timer из пакета; после продления перечитать nginx
  install -d /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/bin/sh\nsystemctl reload nginx\n' >/etc/letsencrypt/renewal-hooks/deploy/reload-nginx
  chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
fi

say "7. Сеть и SSH"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
if [ -s /root/.ssh/authorized_keys ]; then
  printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' >/etc/ssh/sshd_config.d/10-gg.conf
  systemctl reload ssh || systemctl reload sshd || true
else
  echo "ВНИМАНИЕ: у root нет SSH-ключа - вход по паролю НЕ отключаю, чтобы не потерять доступ. Добавь ключ и перезапусти."
fi
cat >/etc/fail2ban/jail.d/gg.conf <<'EOF'
[sshd]
enabled = true
[nginx-http-auth]
enabled = true
EOF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

say "Готово. Дальше:"
cat <<EOF
  1. Заполнить /etc/gg/secrets.env (шаблон: $OPS/conf/secrets.env.example)
  2. Завести логины:  htpasswd -B /etc/nginx/gg.htpasswd <логин>
  3. Первый выкат:    sudo -u gg gg-poll          (дальше сам каждые 2 минуты)
  4. Проверка задачи: sudo -u gg gg-job rop-snapshot
  5. Включить расписание задач: /usr/local/sbin/gg-apply-timers
  6. Статус:          sudo -u gg gg-status        или https://${DOMAIN:-<домен>}/status/
EOF
