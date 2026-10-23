# Deployment & Configuration Guide

## Quick Deployment Checklist

- [ ] All 6 core JavaScript/HTML files uploaded to server
- [ ] HTTPS enabled (required for Web Bluetooth)
- [ ] Files served with correct MIME types
- [ ] SSL certificate valid and non-expired
- [ ] Tested in Bluefy on iOS 15+ device
- [ ] Printer connectivity verified
- [ ] Customizations applied (store name, items, etc.)

## File Deployment Structure

```
your-domain.com/pos/
├── index.html          (Main application)
├── styles.css          (Styling)
├── storage.js          (State management)
├── receipt.js          (Receipt generation)
├── bluetooth.js        (BLE communication)
└── app.js              (Application logic)
```

## Server Configuration

### MIME Types (Important!)

Ensure your web server is configured to serve the correct MIME types:

```
.html  → text/html
.css   → text/css
.js    → application/javascript
```

**Nginx Example:**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.crt;
    ssl_certificate_key /path/to/key.key;

    # Ensure HTTPS only
    location / {
        root /var/www/html/pos;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # Cache static assets
    location ~* \.(css|js)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Apache Example:**
```apache
<VirtualHost *:443>
    ServerName your-domain.com
    DocumentRoot /var/www/html/pos

    SSLEngine on
    SSLCertificateFile /path/to/cert.crt
    SSLCertificateKeyFile /path/to/key.key

    <Directory /var/www/html/pos>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    <FilesMatch "\.css$">
        AddType text/css .css
    </FilesMatch>

    <FilesMatch "\.js$">
        AddType application/javascript .js
    </FilesMatch>

    # Cache headers
    <FilesMatch "\.(css|js)$">
        Header set Cache-Control "public, max-age=604800, immutable"
    </FilesMatch>
</VirtualHost>
```

## HTTPS/SSL Setup

Web Bluetooth API **requires a secure context (HTTPS)**. Here are options:

### Option 1: Let's Encrypt (Free)
```bash
# Using Certbot
sudo certbot certonly --webroot -w /var/www/html/pos -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Option 2: Self-Signed (Testing Only)
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Note: Won't work in Bluefy without special browser configuration
```

### Option 3: Hosting Providers
- Vercel (recommended) - auto HTTPS, global CDN
- Netlify - auto HTTPS, easy deployment
- AWS CloudFront - HTTPS included
- Google Cloud Platform - HTTPS included
- Azure App Service - HTTPS included

## Customization Before Deployment

### 1. Store Information (receipt.js)

Replace hardcoded header with your store details:

```javascript
// Around line 90 in receipt.js
receiptBytes.push(COMMANDS.CENTER);
receiptBytes.push(stringToBytes('Your Store Name'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('Your Address Line 1'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('Your Address Line 2'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('City, Country, Postal'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('Tel: Your-Phone-Number'));
receiptBytes.push(COMMANDS.LINEFEED);
```

### 2. Default Menu Items (storage.js)

Modify the DEFAULT_ITEMS array around line 14:

```javascript
const DEFAULT_ITEMS = [
    { id: 1, name: 'Your Item 1', price: 5.50 },
    { id: 2, name: 'Your Item 2', price: 6.00 },
    { id: 3, name: 'Your Item 3', price: 7.50 },
    { id: 4, name: 'Your Item 4', price: 5.00 },
    { id: 5, name: 'Your Item 5', price: 4.00 },
    { id: 6, name: 'Your Item 6', price: 6.50 },
    { id: 7, name: 'Your Item 7', price: 2.50 },
    { id: 8, name: 'Your Item 8', price: 2.00 }
];
```

### 3. UI Color Branding (styles.css)

Customize the color scheme around line 8:

```css
:root {
    --primary-color: #1a73e8;      /* Main brand color */
    --primary-dark: #1565c0;       /* Dark variant */
    --secondary-color: #34a853;    /* Accent color */
    --danger-color: #d33427;       /* Delete/remove color */
    --warning-color: #fbbc04;      /* Warning color */
    /* ... rest of variables ... */
}
```

### 4. Print Settings (bluetooth.js)

Adjust for your specific printer (around line 144):

```javascript
const CHUNK_SIZE = 100;    // Bytes per transmission
                           // Decrease to 50-75 for tiny buffers
                           // Increase to 150-200 for fast printers

const DELAY_MS = 75;       // Milliseconds between chunks
                           // Increase to 100-150 for slow printers
                           // Decrease to 50 for fast printers
```

## Testing Locally (Before HTTPS Deployment)

### Using Chrome DevTools Simulator
1. Open Chrome on desktop
2. Open DevTools (F12)
3. In Console, the app will show Web Bluetooth is unavailable
4. You can still test all non-Bluetooth functionality

### Using ngrok (Local HTTPS Tunnel)
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start local server
python3 -m http.server 8000

# Tunnel to HTTPS
ngrok http 8000

# Visit: https://[ngrok-domain].ngrok.io on any iOS device
```

### Using Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project directory
vercel

# Follow prompts - automatic HTTPS provided
```

## Performance Optimization

### 1. Enable Compression (Nginx)
```nginx
gzip on;
gzip_types text/plain text/css application/javascript;
gzip_min_length 1000;
```

### 2. Enable Compression (Apache)
```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>
```

### 3. Cache Strategy
- **HTML:** No cache (always fresh)
- **CSS/JS:** Long cache (1 week) with versioning
- **localStorage:** Automatic (browser-side)

```nginx
# Nginx caching example
location /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

location ~* \.(css|js)$ {
    add_header Cache-Control "public, max-age=604800, immutable";
}
```

## Monitoring & Debugging

### 1. Browser Console
On iOS in Bluefy:
- Press long on URL bar to open inspector
- Watch console for connection/print errors
- Check Network tab for asset loading

### 2. Error Logging (Optional Enhancement)
Add this to app.js to track errors:

```javascript
// Send errors to external logging service
window.addEventListener('error', (event) => {
    console.error('App Error:', event.error);
    // Optionally send to logging service
    // fetch('/api/logs', { method: 'POST', body: JSON.stringify({ ... }) });
});
```

### 3. Printer Connection Testing
Enable verbose logging by uncommenting console.logs in bluetooth.js:

```javascript
// Around line 50
console.log('Device selected:', device.name, device.id);
console.log('GATT connected');
console.log('Found services:', services.length);
```

## Security Considerations

### 1. Content Security Policy (CSP)
If you want to add CSP headers (optional):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:
```

### 2. CORS (Not needed for this app)
This app doesn't make external API calls, so CORS is not required.

### 3. Data Privacy
- All customer transaction data stays on device (localStorage)
- No data transmitted to external servers
- No tracking or analytics (as implemented)

## Device Compatibility

### iOS Requirements
- **iOS 15.0+** (Web Bluetooth requirement)
- **Bluefy Web Browser** (Safari doesn't support Web Bluetooth on iOS)
- **iPhone 6S+** or **iPad (2017+)** (Bluetooth LE hardware)

### Printer Requirements
- **58mm Thermal Printer** (standard width)
- **Bluetooth Low Energy (BLE)** capable
- **Standard or custom GATT write characteristic**
- Common models: POS-5890C, POS-58, and other generic Chinese thermal printers

## Troubleshooting Deployment

### Issue: "Web Bluetooth not available"
**Solution:** Ensure user is using Bluefy, not Safari. Web Bluetooth is not available in standard iOS Safari due to Apple restrictions.

### Issue: HTTPS not working
**Solution:** Verify SSL certificate is valid:
```bash
# Check certificate
openssl s_client -connect your-domain.com:443

# Should show: "Verify return code: 0 (ok)"
```

### Issue: Files not loading
**Solution:** Check:
1. MIME types configured correctly on server
2. File permissions (should be world-readable, 644)
3. No URL rewrite rules blocking CSS/JS
4. Check browser cache (hard refresh: Ctrl+Shift+R)

### Issue: Printer not found during scan
**Solution:**
1. Ensure printer is powered and in pairing mode
2. Restart printer and app
3. Check if other BLE apps can find the printer
4. Verify printer hasn't limited device discovery

### Issue: Print cuts off
**Solution:** Adjust chunk size and delay in bluetooth.js:
```javascript
// Try these combinations:
const CHUNK_SIZE = 50;   // Very small chunks
const DELAY_MS = 150;    // Longer delay between sends
```

## Maintenance

### Regular Updates
- Monitor Web Bluetooth API changes
- Keep ESC/POS command reference updated
- Test with new iOS versions as released

### Backup Strategy
- Version control all source files (Git)
- Regular database backups of transaction logs (if added)
- Document all customizations made

### Support & Monitoring
- Keep console logs enabled for debugging
- Document any printer-specific quirks discovered
- Maintain list of compatible printer models

---

**Version:** 1.0  
**Last Updated:** October 23, 2026  
**Target Browser:** Bluefy on iOS 15+
