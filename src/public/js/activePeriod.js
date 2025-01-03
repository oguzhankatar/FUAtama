document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('activePeriodForm');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');

    // Load current active period if exists
    fetch('/api/active-period')
        .then(response => response.json())
        .then(data => {
            if (data && data.startDate && data.endDate) {
                document.getElementById('startDate').value = data.startDate.split('T')[0];
                document.getElementById('endDate').value = data.endDate.split('T')[0];
            }
        })
        .catch(error => console.error('Error loading active period:', error));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        try {
            const response = await fetch('/api/active-period', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ startDate, endDate })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            // Show success message
            successAlert.style.display = 'block';
            errorAlert.style.display = 'none';

            // Redirect to home page after 2 seconds
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);

        } catch (error) {
            console.error('Error saving active period:', error);
            errorAlert.style.display = 'block';
            successAlert.style.display = 'none';
        }
    });
});
