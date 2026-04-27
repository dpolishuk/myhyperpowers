const fs = require('fs');
const data = JSON.parse(fs.readFileSync('gh_comments.json', 'utf8'));
const unresolved = data.data.repository.pullRequest.reviewThreads.nodes.filter(n => !n.isResolved);
fs.writeFileSync('unresolved.json', JSON.stringify(unresolved, null, 2));