const fs = require('fs');
const axios = require('axios');
const yaml = require('yaml');
const process = require('process');

// To keep track of request counts for availability calculation
const totalRequests = {};
const upRequests = {};

function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (error) {
        console.error(`Invalid URL: ${url}`);
        return null;
    }
}

// Check the health of a single HTTP endpoint
async function checkEndpoint(endpoint) {
    const url = endpoint.url;
    const method = endpoint.method ? endpoint.method.toUpperCase() : 'GET';
    const headers = endpoint.headers || {};
    const body = endpoint.body ? JSON.parse(endpoint.body) : null;

    try {
        const options = {
            method,
            url,
            headers,
            data: body,
            timeout: 5000 // 5 seconds timeout
        };

        const startTime = Date.now();
        const response = await axios(options);
        const latency = Date.now() - startTime;

        // Check if the response is "UP"
        return response.status >= 200 && response.status < 300 && latency < 500;
    } catch (error) {
        return false;
    }
}

// Log the cumulative availability percentage for each domain
function logAvailability() {
    for (const domain in totalRequests) {
        const total = totalRequests[domain];
        const upCount = upRequests[domain] || 0;
        const availability = Math.round((upCount / total) * 100);
        console.log(`${domain} has ${availability}% availability percentage`);
    }
}

// Main loop for running health checks every 15 seconds
async function runHealthChecks(configFilePath) {
    // Read and parse the YAML configuration file
    const fileContent = fs.readFileSync(configFilePath, 'utf8');
    const config = yaml.parse(fileContent);

    console.log("Starting health checks... (Press CTRL+C to stop)");

    try {
        while (true) {
            for (const endpoint of config) {
                const url = endpoint.url;
                const domain = extractDomain(url);

                if (!domain) continue;

                // Initialize request counts for the domain if not already set
                totalRequests[domain] = (totalRequests[domain] || 0) + 1;

                const isUp = await checkEndpoint(endpoint);
                if (isUp) {
                    upRequests[domain] = (upRequests[domain] || 0) + 1;
                }

                logAvailability();
            }

            await new Promise((resolve) => setTimeout(resolve, 15000));
        }
    } catch (error) {
        console.error('Error running health checks:', error);
    }
}

// Entry point of the script
const args = process.argv.slice(2);
if (args.length !== 1) {
    console.error('Usage: node health_check.js <path_to_config_file>');
    process.exit(1);
}

const configFilePath = args[0];
runHealthChecks(configFilePath);
