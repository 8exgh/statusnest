// Test authentication flow
const API_URL = 'http://localhost:3000';

async function testAuth() {
  console.log('Testing authentication flow...\n');
  
  // Test registration
  console.log('1. Testing registration...');
  const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  });
  
  const registerData = await registerResponse.json();
  if (!registerResponse.ok) {
    console.log('Registration failed:', registerData.error);
    return;
  }
  
  console.log('✓ Registration successful');
  console.log('  User ID:', registerData.user.id);
  console.log('  Token:', registerData.token.substring(0, 20) + '...');
  
  const token = registerData.token;
  
  // Test authenticated request
  console.log('\n2. Testing authenticated request...');
  const statusResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const statusData = await statusResponse.json();
  if (!statusResponse.ok) {
    console.log('✗ Status request failed:', statusData.error);
    return;
  }
  
  console.log('✓ Authenticated request successful');
  console.log('  Domains:', statusData.domains);
  
  // Test adding a domain
  console.log('\n3. Testing domain registration...');
  const domainResponse = await fetch(`${API_URL}/api/domains/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      domain: 'example.com'
    })
  });
  
  const domainData = await domainResponse.json();
  if (!domainResponse.ok) {
    console.log('✗ Domain registration failed:', domainData.error);
    return;
  }
  
  console.log('✓ Domain registered successfully');
  console.log('  Domain ID:', domainData.domainId);
  
  // Check domains again
  console.log('\n4. Checking domains list...');
  const domainsResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const domainsData = await domainsResponse.json();
  console.log('✓ Domains:', domainsData.domains.map(d => d.domain).join(', '));
  
  // Test logout
  console.log('\n5. Testing logout...');
  const logoutResponse = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!logoutResponse.ok) {
    console.log('✗ Logout failed');
    return;
  }
  
  console.log('✓ Logout successful');
  
  // Test that token is now invalid
  console.log('\n6. Testing that token is invalidated...');
  const invalidResponse = await fetch(`${API_URL}/api/domains/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (invalidResponse.ok) {
    console.log('✗ Token still valid after logout!');
    return;
  }
  
  console.log('✓ Token properly invalidated');
  
  console.log('\n✅ All tests passed!');
}

testAuth().catch(console.error);