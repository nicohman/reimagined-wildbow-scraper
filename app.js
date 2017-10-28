#!/usr/bin/env node
var https = require('follow-redirects').https;
var program = require("commander");
var fs = require('fs');
program.version('0.0.1').option("-r , --resume <html>", "Resume from HTML file").option('-w, --worm', "Scrape Worm").option("-t, --twig", "Scrape Twig").option("-p, --pact", "Scrape Pact").parse(process.argv);
var cheerio = require('cheerio');
var Epub = require("epub-gen");
const url = require('url')
const urlCon = url.URL
var legacy = false;
var version;
try {
    version = parseInt(process.versions.node[0])
} catch (err) {
    version = 0;
}
if (version <= 6) {
    //User is using legacy node.
    legacy = true;
}

function returnURL(url) {
    if (legacy) {
        return url.parse(url)
    } else {
        var newurl = new urlCon(url)
        return newurl
    }
}
var urls = {
    pact: ["pactwebserial.wordpress.com", "/category/story/arc-1-bonds/1-01/"],
    worm: ["parahumans.wordpress.com", "/2011/06/11/1-1/"],
    twig: ["twigserial.wordpress.com", "/2014/12/24/taking-root-1-1/"]
}
var books = {
    worm: {
        title: "Worm",
        author: "John McCrae",
        content: []
    },
    twig: {
        title: "Twig",
        author: "John McCrae",
        content: []
    },
    pact: {
        title: "Pact",
        author: "John McCrae",
        content: []
    },
}
var scrapeChap = function(url, name) {
    https.get({
        hostname: url[0],
        path: url[1],
        port: 443,
        agent: undefined
    }, function(res) {
        var agg = '';
        res.on("data", function(bit) {
            agg += bit;
        });
        res.on('end', function() {
            var data = "";
            var $ = cheerio.load(agg);
            var ps = $('div.entry-content p').map(function() {
                return $(this).text().trim()
            }).get();
            ps.splice(0, 1);
            ps.splice(ps.length - 1, 1)
            var found = false;
            var next = $('div.entry-content p a')
            next.each(function(item) {
                if ($(this).text() == "Next" || $(this).text() == "Next Chapter" || $(this).text() == " Next Chapter") {
                    next = $(this).prop("href")
                    found = true;
                } else {}
            })
            if (found) {
                if (next[0] == "/") {
                    next = "https:" + next;
                }
                var nexturl = returnURL(next);
                next = nexturl.pathname;
            } else {}
            var title = $("h1.entry-title").text()

            ps.forEach(function(p) {
                var str = "<p>" + p + "</p>"
                data += str;
            })
            books[name].content.push({
                title: title,
                data: data
            })
            console.log("Reading " + title)
            if (found == false) {
                console.log(next.text(1))
                console.log("Done reading in " + name);
                fs.open("./" + name + ".json", "w+", function(err, fd) {
                    books[name].last = url;
                    fs.writeFile("./" + name + ".json", JSON.stringify(books[name]), function(err) {})
                })
                new Epub(books[name], "./" + name + ".epub");
            } else {
                console.log(next)
                scrapeChap([urls[name][0], next], name);
            }
        })
    })
}
if (program.resume) {
    fs.readFile('./' + program.resume, function(err, data) {
        data = JSON.parse(data);
        books[data.title.toLowerCase()] = data;
        https.get({
            hostname: data.last[0],
            path: data.last[1],
            port: 443,
            agent: undefined
        }, function(res) {
            var agg = '';
            res.on("data", function(bit) {
                agg += bit;
            });
            res.on('end', function() {
                var $ = cheerio.load(agg);
                var found = false;
                var next = $('div.entry-content p a')
                next.each(function(item) {
                    if ($(this).text() == "Next" || $(this).text() == "Next Chapter" || $(this).text() == " Next Chapter") {
                        next = $(this).prop("href")
                        found = true;
                    } else {}
                })
                if (found) {
                    if (next[0] == "/") {
                        next = "https:" + next;
                    }
                    var nexturl = returnURL(next);
                    next = nexturl.pathname;
                }
                if (next == data.last[1]) {
                    console.log("Already the most updated version")
                } else {
                    scrapeChap([data.last[0], next])
                }
            });
        });
        scrapeChap(books[data.title.toLowerCase()].last, data.title.toLowerCase());
    })
} else if (program.twig) {
    scrapeChap(urls.twig, "twig");
} else if (program.worm) {
    scrapeChap(urls.worm, "worm")
} else if (program.pact) {
    scrapeChap(urls.pact, "pact")
}