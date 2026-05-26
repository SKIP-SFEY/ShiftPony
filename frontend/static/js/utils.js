function formatDate(dateString) {
    if (!dateString) return '';

    try {
        return new Date(dateString).toLocaleDateString('ru-RU');
    } catch (error) {
        return dateString;
    }
}
