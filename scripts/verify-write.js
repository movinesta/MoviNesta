const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch if Node 18+

const URL = 'https://strhxqxvsrecfilfojtc.supabase.co/functions/v1/test-write';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cmh4cXh2c3JlY2ZpbGZvanRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTUyNDAsImV4cCI6MjA3OTE3MTI0MH0.DZE2vpUTEqAAIMzT5GUxeV99d98RjDcG-a5IhUtasrI';

async function main() {
    try {
        const res = await fetch(URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Body:', text);
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
