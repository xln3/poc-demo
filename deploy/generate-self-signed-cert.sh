#!/bin/bash
# Generate self-signed TLS certificate for development/testing.
# Production: replace with Let's Encrypt or CA-signed certificate.

set -e

CERT_DIR="${1:-./certs}"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    echo "Certificates already exist in $CERT_DIR — skipping."
    echo "Delete them first if you want to regenerate."
    exit 0
fi

echo "Generating self-signed certificate in $CERT_DIR ..."
openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=localhost/O=POC-Demo/C=CN" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Done. Files created:"
echo "  $CERT_DIR/fullchain.pem"
echo "  $CERT_DIR/privkey.pem"
echo ""
echo "For production, replace these with CA-signed certificates."
