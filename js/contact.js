function sendMessage() {
    let subject = document.getElementById("subjectbox").value;
    let message = document.getElementById("messagebox").value;

    window.location.href = `mailto:daniel@kashepava.com?subject=${subject}&body=${message}`;
}