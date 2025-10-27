const url = 'https://prod.api.reflect.money/integration/initialize';

// Request body with readable formatting
const requestBody = {
  "signer": "8gSUQ9RpTKTVnGnQ5evNrKzANKbicFRBa5Ub1oqC2fYf",
  "authority": "8gSUQ9RpTKTVnGnQ5evNrKzANKbicFRBa5Ub1oqC2fYf",
  "stablecoin": 0,
  "feeBps": 100,
  "brandedMint": "usd63SVWcKqLeyNHpmVhZGYAqfE5RHE8jwqjRA2ida2",
  "feePayer": "8gSUQ9RpTKTVnGnQ5evNrKzANKbicFRBa5Ub1oqC2fYf"
};

const options = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody)
};

async function initializeReflectAdmin() {
  try {
    console.log('Initializing Reflect Money admin permissions...');
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, options);
    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Reflect Money admin permissions initialized successfully!');
    } else {
      console.log('❌ Failed to initialize admin permissions');
    }
  } catch (error) {
    console.error('❌ Error initializing Reflect Money admin permissions:', error);
  }
}

// Run the initialization
initializeReflectAdmin();
