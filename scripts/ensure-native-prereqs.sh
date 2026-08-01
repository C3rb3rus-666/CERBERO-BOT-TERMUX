#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

have() { command -v "$1" >/dev/null 2>&1; }
run_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif have sudo; then
    sudo "$@"
  elif have doas; then
    doas "$@"
  else
    return 1
  fi
}

is_termux() {
  [[ -n "${TERMUX_VERSION:-}" ]] || [[ "${PREFIX:-}" == *termux* ]]
}

need_glib_header() {
  [[ ! -f /usr/include/glib-2.0/glib-object.h ]]
}

install_for_apt() {
  run_root apt-get update
  run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    libglib2.0-dev libvips-dev libwebp-dev libcairo2-dev libpango1.0-dev \
    libjpeg-dev libpng-dev libgif-dev librsvg2-dev
}

install_for_termux() {
  pkg install -y glib vips webp cairo pango jpeg-turbo libpng giflib librsvg
}

install_for_pacman() {
  run_root pacman -Syu --needed --noconfirm glib vips libwebp cairo pango jpeg-turbo libpng giflib librsvg
}

install_for_apk() {
  run_root apk add --no-cache glib-dev vips-dev webp-dev cairo-dev pango-dev jpeg-dev libpng-dev giflib-dev librsvg-dev
}

install_for_dnf() {
  run_root dnf install -y glib2-devel vips-devel libwebp-devel cairo-devel pango-devel libjpeg-turbo-devel libpng-devel giflib-devel librsvg2-devel
}

install_for_yum() {
  run_root yum install -y glib2-devel vips-devel libwebp-devel cairo-devel pango-devel libjpeg-turbo-devel libpng-devel giflib-devel librsvg2-devel
}

install_for_zypper() {
  run_root zypper --non-interactive install glib2-devel vips-devel libwebp-devel cairo-devel pango-devel libjpeg-turbo-devel libpng16-devel giflib-devel librsvg-devel
}

install_for_xbps() {
  run_root xbps-install -Syu
  run_root xbps-install -y glib-devel vips-devel libwebp-devel cairo-devel pango-devel libjpeg-turbo-devel libpng-devel giflib-devel librsvg-devel
}

if ! command -v npm >/dev/null 2>&1; then
  exit 0
fi

if ! need_glib_header; then
  exit 0
fi

case 1 in
  1)
    if is_termux && have pkg; then
      install_for_termux || true
      exit 0
    fi
    if have apt-get; then install_for_apt || true; fi
    if have pacman; then install_for_pacman || true; fi
    if have apk; then install_for_apk || true; fi
    if have dnf; then install_for_dnf || true; fi
    if have yum; then install_for_yum || true; fi
    if have zypper; then install_for_zypper || true; fi
    if have xbps-install; then install_for_xbps || true; fi
    ;;
esac

exit 0
