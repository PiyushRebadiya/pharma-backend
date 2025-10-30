const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { errorMessage } = require('../common/main');
const ncp = require('ncp').ncp;

// Promisify the exec function to work with async/await
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error: ${stderr || error.message}`);
        return;
      }
      resolve(stdout);
    });
  });
};

// Promisify the ncp (copy) function to work with async/await
const ncpPromise = (source, target) => {
  return new Promise((resolve, reject) => {
    ncp(source, target, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

// Function to set up IIS for a given subdomain
const setupIISForSubdomain = async (req, res) => {
  const { subDomainName } = req.body;
  if (!subDomainName) return res.status(400).send(errorMessage('subDomainName is required'));

  const targetDir = `C:\\inetpub\\wwwroot\\React ${subDomainName}`;
  const appName = subDomainName;
  const appPath = targetDir;
  const iisConfigPath = path.join(targetDir, 'web.config');
  const envFilePath = path.join(targetDir, '.env');
  const appPoolName = `React${subDomainName}AppPool`;
  const siteName = `React${subDomainName}Site`;
  const subdomain = `${subDomainName.toLowerCase()}.myeventz.in`;
  const siteUrl = `https://${subdomain}`;
  const appCmdPath = `"C:\\Windows\\System32\\inetsrv\\appcmd.exe"`;

  const sourceDir = `C:\\inetpub\\wwwroot\\React NavChetna Build`;

  try {
    if (fs.existsSync(sourceDir)) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log('Target directory created:', targetDir);
      }

      await ncpPromise(sourceDir, targetDir);
      console.log(`Successfully copied build folder from ${sourceDir} to ${targetDir}`);

      // Create `.env` file
      const envContent = `
      REACT_APP_API_URL=${siteUrl}
      REACT_APP_API_OrganizerUkeyId=7a2d29de-45e1-48dc-a757-009c041d924e
      `;
      fs.writeFileSync(envFilePath, envContent.trim(), 'utf-8');
      console.log('.env file created successfully in target directory.');

      // Create web.config for React routing
      const webConfigContent = `
      <configuration>
        <system.webServer>
          <rewrite>
            <rules>
              <rule name="React Routes" stopProcessing="true">
                <match url=".*" />
                <conditions logicalGrouping="MatchAll">
                  <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                  <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                </conditions>
                <action type="Rewrite" url="/index.html" />
              </rule>
            </rules>
          </rewrite>
        </system.webServer>
      </configuration>
      `;

      if (!fs.existsSync(iisConfigPath)) {
        fs.writeFileSync(iisConfigPath, webConfigContent, 'utf-8');
        console.log('web.config created successfully in target directory.');
      }

      // IIS configuration commands
      const createAppPoolCmd = `${appCmdPath} add apppool /name:"${appPoolName}" /managedRuntimeVersion:v4.0`;
      const createSiteCmd = `${appCmdPath} add site /name:"${siteName}" /physicalPath:"${appPath}" /bindings:http/*:80:${subdomain}`;
      const setAppPoolCmd = `${appCmdPath} set app "${siteName}/" /applicationPool:"${appPoolName}"`;

      const httpsBinding = `154.61.74.83:443:${subdomain}`;
      const sslCertThumbprint = 'WMSVC-SHA2';
      const addHttpsBindingCmd = `${appCmdPath} set site /site.name:"${siteName}" /+bindings.[protocol='https',bindingInformation='${httpsBinding}']`;

      const httpsBindingSubdomain = `*:443:${subdomain}`;
      const addHttpsBindingSubdomainCmd = `${appCmdPath} set site /site.name:"${siteName}" /+bindings.[protocol='https',bindingInformation='${httpsBindingSubdomain}']`;

      const assignCertCmd = `netsh http add sslcert ipport=154.61.74.83:443 certhash=${sslCertThumbprint} appid="{${siteName}}"`;

      const httpBindingSubdomain = `*:80:${subdomain}`;
      const addHttpBindingSubdomainCmd = `${appCmdPath} set site /site.name:"${siteName}" /+bindings.[protocol='http',bindingInformation='${httpBindingSubdomain}']`;

      await execPromise(createAppPoolCmd);
      console.log('App Pool created successfully');
      await execPromise(createSiteCmd);
      console.log('Site created successfully');
      await execPromise(setAppPoolCmd);
      console.log('App Pool set for Site successfully');
      await execPromise(addHttpsBindingCmd);
      console.log('HTTPS Binding with IP 154.61.74.83 added successfully');
      await execPromise(addHttpsBindingSubdomainCmd);
      console.log('HTTPS Binding for subdomain added successfully');
      await execPromise(assignCertCmd);
      console.log('SSL Certificate assigned to IP 154.61.74.83 successfully');
      await execPromise(addHttpBindingSubdomainCmd);
      console.log('HTTP Binding for subdomain added successfully');
    } else {
      console.error(`Source directory does not exist: ${sourceDir}`);
    }
  } catch (err) {
    console.error('Error during IIS setup:', err);
  } finally {
    res.json({
      message: 'Setup completed',
      success: true,
      status: 200,
      domain: siteUrl,
    });
    console.log(`Setup completed for subdomain: ${subDomainName}`);
    console.log(`Site URL: ${siteUrl}`);
  }
};


module.exports = { setupIISForSubdomain };


// Call the function with the subdomain name
// setupIISForSubdomain('Piyush');
