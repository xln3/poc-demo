#!/usr/bin/env bash
#
# setup-sandbox-network.sh
#
# Configures iptables rules to prevent sandbox containers (on the
# poc-sandbox-isolated network, subnet 10.200.0.0/16) from reaching
# private/internal IP ranges while allowing public internet access.
#
# Must be run as root on the Docker host. Rules live in the DOCKER-USER
# chain (Docker's official hook for user-defined forwarding rules) and
# only affect FORWARD traffic — the host's own INPUT/OUTPUT are untouched.
#
# These rules are stored in kernel memory and will be lost on reboot.
# To persist, use one of:
#   - iptables-persistent  (apt install iptables-persistent)
#   - a systemd unit that runs this script at boot
#   - /etc/rc.local
#
# Usage:
#   sudo bash setup-sandbox-network.sh          # apply rules
#   sudo bash setup-sandbox-network.sh --remove  # remove rules
#
set -euo pipefail

SANDBOX_SUBNET="10.200.0.0/16"

# A unique comment tag so we can identify our rules for cleanup
TAG="poc-sandbox-isolation"

remove_rules() {
    echo "Removing existing $TAG rules from DOCKER-USER..."
    # Delete all rules with our comment tag (loop until none remain)
    while iptables -D DOCKER-USER -m comment --comment "$TAG" 2>/dev/null; do :; done
    echo "Done."
}

apply_rules() {
    # Ensure DOCKER-USER chain exists (Docker creates it, but be safe)
    iptables -N DOCKER-USER 2>/dev/null || true

    # Remove old rules first to make this script idempotent
    remove_rules

    echo "Applying $TAG rules to DOCKER-USER..."

    # 1. Allow sandbox-to-sandbox traffic (container inter-communication)
    iptables -I DOCKER-USER -s "$SANDBOX_SUBNET" -d "$SANDBOX_SUBNET" \
        -m comment --comment "$TAG" -j RETURN

    # 2. Block private networks (RFC 1918 + link-local)
    iptables -I DOCKER-USER 2 -s "$SANDBOX_SUBNET" -d 10.0.0.0/8 \
        -m comment --comment "$TAG" -j DROP
    iptables -I DOCKER-USER 3 -s "$SANDBOX_SUBNET" -d 172.16.0.0/12 \
        -m comment --comment "$TAG" -j DROP
    iptables -I DOCKER-USER 4 -s "$SANDBOX_SUBNET" -d 192.168.0.0/16 \
        -m comment --comment "$TAG" -j DROP

    # 3. Block link-local / cloud metadata endpoint (169.254.169.254)
    iptables -I DOCKER-USER 5 -s "$SANDBOX_SUBNET" -d 169.254.0.0/16 \
        -m comment --comment "$TAG" -j DROP

    echo "Rules applied. Current DOCKER-USER chain:"
    iptables -L DOCKER-USER -n -v --line-numbers
}

# --- Main ---
if [[ "${1:-}" == "--remove" ]]; then
    remove_rules
else
    apply_rules
fi
