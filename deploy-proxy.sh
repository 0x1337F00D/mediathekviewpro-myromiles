#!/usr/bin/env bash
set -euo pipefail
config=/opt/aiostreams/Caddyfile
backup="${config}.before-mediathek-$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$config" "$backup"
rollback() { cp "$backup" "$config"; }
trap rollback ERR
perl -0777 -e '
  my $file = shift; open my $in, "<", $file or die $!; local $/; my $text = <$in>; close $in;
  unless ($text =~ /handle_path \/mediathek\/\*/) {
    $text =~ s/(sackfloete\.duckdns\.org\s*\{.*?\n\troute \{)/$1\n\t\thandle_path \/mediathek\/* {\n\t\t\treverse_proxy mediathek-addon:7000\n\t\t}\n/s or die "site route not found";
    open my $out, ">", $file or die $!; print $out $text; close $out;
  }
' "$config"
docker exec aiostreams-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec aiostreams-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
trap - ERR
