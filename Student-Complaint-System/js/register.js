import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Handle registration form submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    
    try {
        // Create Firebase Auth account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            role: 'student',
            createdAt: serverTimestamp()
        });
        
        // Redirect to student dashboard
        window.location.href = 'student-dashboard.html';
        
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = error.message;
        
        // Provide user-friendly error messages
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'An account with this email already exists. Please use the login page.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters long.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
    }
});