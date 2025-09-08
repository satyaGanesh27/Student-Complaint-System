import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Get selected role from localStorage
const selectedRole = localStorage.getItem('selectedRole') || 'student';

// Update UI based on selected role
const authTitle = document.getElementById('authTitle') || document.querySelector('.auth-title');
const authIcon = document.querySelector('.auth-icon');

if (authTitle) {
    authTitle.textContent = `${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Login`;
}

// Update icon color based on role
if (authIcon) {
    authIcon.className = 'auth-icon';
    if (selectedRole === 'teacher') {
        authIcon.style.background = '#dcfce7';
        authIcon.style.color = '#16a34a';
    } else if (selectedRole === 'admin') {
        authIcon.style.background = '#f3e8ff';
        authIcon.style.color = '#9333ea';
    }
}

// Show register link only for students
if (selectedRole === 'student') {
    document.getElementById('studentRegisterLink').style.display = 'block';
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    
    try {
        // Sign in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Get user document from Firestore to verify role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            throw new Error('User profile not found. Please contact administrator.');
        }
        
        const userData = userDoc.data();
        
        // Verify role matches selection
        if (userData.role !== selectedRole) {
            throw new Error(`Invalid role. You selected ${selectedRole} but your account is registered as ${userData.role}.`);
        }
        
        // Redirect based on role
        switch (userData.role) {
            case 'student':
                window.location.href = 'student-dashboard.html';
                break;
            case 'teacher':
                window.location.href = 'teacher-dashboard.html';
                break;
            case 'admin':
                window.location.href = 'admin-dashboard.html';
                break;
            default:
                throw new Error('Invalid user role');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Provide helpful error messages
        if (error.code === 'auth/invalid-credential') {
            if (selectedRole === 'student') {
                errorDiv.textContent = 'Invalid email or password. If you don\'t have an account, please register first.';
            } else {
                errorDiv.textContent = `Invalid ${selectedRole} credentials. Please contact the administrator or check the README for account setup instructions.`;
            }
        } else if (error.code === 'auth/user-not-found') {
            errorDiv.textContent = 'No account found with this email address.';
        } else if (error.code === 'auth/wrong-password') {
            errorDiv.textContent = 'Incorrect password.';
        } else {
            errorDiv.textContent = error.message;
        }
        
        errorDiv.style.display = 'block';
    }
});

// Check if user is already logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // Redirect to appropriate dashboard
                switch (userData.role) {
                    case 'student':
                        window.location.href = 'student-dashboard.html';
                        break;
                    case 'teacher':
                        window.location.href = 'teacher-dashboard.html';
                        break;
                    case 'admin':
                        window.location.href = 'admin-dashboard.html';
                        break;
                }
            }
        } catch (error) {
            console.error('Error checking user role:', error);
        }
    }
});