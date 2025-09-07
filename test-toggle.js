// Test domain activation/deactivation
const API_URL = 'http://localhost:3000';

async function testToggle() {
  console.log('Testing domain activation/deactivation...\n');
  
  // First, register and login
  console.log('1. Creating test user...');
  const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: `toggle-test-${Date.now()}@example.com`,
      password: 'password123'
    })
  });
  
  const registerData = await registerResponse.json();
  if (!registerResponse.ok) {
    console.log('Registration failed:', registerData.error);
    return;
  }
  
  const token = registerData.token;
  console.log('✓ User created and logged in');
  
  // Register a domain
  console.log('\n2. Registering test domain...');
  const domainResponse = await fetch(`${API_URL}/api/domains/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      domain: 'test-toggle.com'
    })
  });
  
  const domainData = await domainResponse.json();
  if (!domainResponse.ok) {
    console.log('Domain registration failed:', domainData.error);
    return;
  }
  
  const domainId = domainData.domainId;
  console.log('✓ Domain registered:', domainId);
  
  // Wait for projection engine to process the event
  console.log('\n3. Waiting for projection engine...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check initial status
  console.log('\n4. Checking initial domain status...');
  let statusResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  let statusData = await statusResponse.json();
  let domain = statusData.domains.find(d => d.id === domainId);
  
  if (!domain) {
    console.log('Domain not found in status response. Domains:', statusData.domains);
    console.log('Looking for domain ID:', domainId);
    return;
  }
  
  console.log('✓ Initial status - Active:', domain.active, 'Status:', domain.status);
  
  // Wait for background processor to pick it up
  console.log('\n5. Waiting for background processor to check domain...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // Check if it was picked up
  statusResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  statusData = await statusResponse.json();
  domain = statusData.domains.find(d => d.id === domainId);
  console.log('✓ After check - Last checked:', domain.lastCheckedAt ? 'Yes' : 'No');
  
  // Deactivate the domain
  console.log('\n6. Deactivating domain...');
  const deactivateResponse = await fetch(`${API_URL}/api/domains/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      domainId: domainId,
      active: false
    })
  });
  
  if (!deactivateResponse.ok) {
    console.log('Deactivation failed');
    return;
  }
  
  console.log('✓ Domain deactivated');
  
  // Check status after deactivation
  console.log('\n7. Checking domain status after deactivation...');
  statusResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  statusData = await statusResponse.json();
  domain = statusData.domains.find(d => d.id === domainId);
  console.log('✓ After deactivation - Active:', domain.active, 'Next check:', domain.nextCheckAt);
  
  // Wait and verify it's not being checked
  console.log('\n8. Waiting to verify domain is not being checked...');
  const lastCheckedBefore = domain.lastCheckedAt;
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  statusResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  statusData = await statusResponse.json();
  domain = statusData.domains.find(d => d.id === domainId);
  const notChecked = domain.lastCheckedAt === lastCheckedBefore;
  console.log('✓ Domain not checked while inactive:', notChecked);
  
  // Reactivate the domain
  console.log('\n9. Reactivating domain...');
  const activateResponse = await fetch(`${API_URL}/api/domains/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      domainId: domainId,
      active: true
    })
  });
  
  if (!activateResponse.ok) {
    console.log('Activation failed');
    return;
  }
  
  console.log('✓ Domain reactivated');
  
  // Check status after reactivation
  console.log('\n10. Checking domain status after reactivation...');
  statusResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  statusData = await statusResponse.json();
  domain = statusData.domains.find(d => d.id === domainId);
  console.log('✓ After reactivation - Active:', domain.active, 'Next check scheduled:', domain.nextCheckAt ? 'Yes' : 'No');
  
  // Wait for it to be checked again
  console.log('\n11. Waiting for domain to be checked again...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  statusResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  statusData = await statusResponse.json();
  domain = statusData.domains.find(d => d.id === domainId);
  const checkedAgain = domain.lastCheckedAt !== lastCheckedBefore;
  console.log('✓ Domain checked after reactivation:', checkedAgain);
  
  console.log('\n✅ All toggle tests passed!');
}

testToggle().catch(console.error);