const puppeteer = require('puppeteer');
const fs = require('fs');

async function getDocsGraph() {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await page.goto('https://docs.kumu.io/');

    let sidebarHeaders = await page.evaluate(headers => {
        let lis = document.querySelectorAll('.summary .header');
        lis.forEach(li => {
            headers.push(li.innerHTML);
        });
        return headers;
    }, []);

    let sidebarLinks = await page.evaluate(links => {
        let anchors = document.querySelectorAll('.summary a');
        anchors.forEach(anchor => {
            if(/\#/.test(anchor.href) === false && /gitbook\.com/.test(anchor.href) === false) {
                let obj = new Object();
                obj.id = anchor.href;

                if(obj.id.split('https://docs.kumu.io')[1] && obj.id.split('https://docs.kumu.io')[1].split('/')[1]) {
                    obj['element type'] = obj.id.split('https://docs.kumu.io')[1].split('/')[1];
                } else {
                    obj['element type'] = 'home';
                }

                links.push(obj);
            }
        });

        return links;
    }, []);

    async function getLabel(link, thisPage) {
        return await thisPage.evaluate(title => {
            title += document.querySelector('.markdown-section *:first-child').textContent;
            return title;
        }, '');
    }

    for(i = 0; i < sidebarLinks.length; i++) {
        let thisPage = await browser.newPage();
        await thisPage.goto(sidebarLinks[i].id);

        sidebarLinks[i].Label = await thisPage.evaluate(title => {
            title += document.querySelector('.markdown-section *:first-child').textContent;
            return title;
        }, '');

        sidebarLinks[i].Links = await thisPage.evaluate(links => {
            let anchors = document.querySelectorAll('.markdown-section a:not(.anchorjs-link)');
            anchors = Array.from(anchors)
                .map(a => a.href.split('#')[0].replace(/\.md$/, '.html'))
                .filter(a => /docs\.kumu\.io/.test(a) === true && /\.html$/.test(a) === true);

            links = links.concat(Array.from( new Set(anchors) ));
            return links;
        }, []);

        await thisPage.close();
    }

    let brokenLinks = [];

    for(i = 0; i < sidebarLinks.length; i++) {
        sidebarLinks[i].Links = sidebarLinks[i].Links
            .map(link => {
                if(sidebarLinks.findIndex(l => l.id === link) !== -1) {
                    return sidebarLinks.find(l => {
                        return l.id === link;
                    }).Label;
                } else {
                    brokenLink.push(link);
                    return link;
                }
            });
    }

    function createElementBlueprint(elementsArray) {
        let elementBlueprint = JSON.parse("{\"elements\":" + JSON.stringify(elementsArray) + "}");
        return JSON.stringify(elementBlueprint, null, 2);
    }

    fs.writeFile('docs.json', createElementBlueprint(sidebarLinks), (err) => {
        if (err) throw err;
        console.log('Map those docs!');
    });
}

getDocsGraph();
