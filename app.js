const express = require('express');
const bodyParser = require('body-parser');
const resolve = require('path').resolve;
const Airtable = require('airtable');
const JSONStream = require('JSONStream');
const app = express();
const VALID_API_KEY = `Provide valid Airtable API Key.`;
app.use(bodyParser.json());

const getAuthentication = () => [{
    'id': 'key',
    'name': 'API Key Authentication',
    'description': 'Provide your API key.',
    'fields': [
        {
            'type': 'text',
            'description': 'API Key',
            'id': 'key'
        },
        {
            'type': 'link',
            'value': 'https://airtable.com/account',
            'description': 'We need to have your Airtable API Key for retrieving data.',
            'id': 'key-link',
            'name': 'Get your key here'
        }
    ]
}];

const getSources = () => [
    {
        id: 'base',
        name: 'Table',
        description: 'Airtable source',
        filter: [{
            id: 'base',
            name: 'Base Id',
            description: `Navigate to https://airtable.com/api. Click on desired base and copy {base id}. 
                It can be found in browser address bar https://airtable.com/{base id}/api/docs#curl/introduction`,
            type: 'text'
        },
            {
                id: 'table',
                name: 'Table Name',
                description: 'Provide the name of the table you would like to visualize',
                type: 'text'
            }
        ]
    }
];

app.get('/', (req, res) => {
    const appConfig = {
        'name': 'Airtable',
        'id': 'airtable',
        'version': '1.0',
        'description': 'Get visual insight into your Airtable spreadsheets',
        'authentication': getAuthentication(),
        'sources': getSources()
    };
    res.json(appConfig);
});

app.get('/logo', (req, res) => res.sendFile(resolve('./logo.svg')));

app.post('/validate', (req, res) => {
    if (!req.body.fields || !req.body.fields.key) {
        throw new Error('Please provide Airtable API Key');
    }
    const key = req.body.fields.key;
    const endingForAccountName = key.substr(key.length - 3, 3);
    //Authentication check is possible only on retrieving data, so we just mark account as valid for now
    res.json({name: `Airtable [*****${endingForAccountName}]`});
});

const getErrorCode = (err) => err.code || err.statusCode || err.status || 500;

const getMessage = (err) => {
    let message = err.message || err.statusText || 'Ops... Something terrible happened';
    if (getErrorCode(err) === 401) {
        message = VALID_API_KEY;
    }
    return message;
};

app.post('/', (req, res) => {
    const apiKey = req.body.account.key;
    const baseId = req.body.filter.base;
    const table = req.body.filter.table;
    const base = new Airtable({apiKey: apiKey}).base(baseId);

    res.type('json');

    const stream = JSONStream.stringify();
    stream.pipe(res);

    const onPageRetrieved = (partialRecords, fetchNextPage) => {
        partialRecords.forEach((row) => {
            const value = Object.assign({
                id: row.id,

                'created on': row._rawJson.createdTime
            }, row.fields);
            stream.write(value);
        });
        fetchNextPage();
    };

    const onFetchingComplete = (err) => {
        if (err) {
            stream.write({
                __streamError: {
                    message: getMessage(err),
                    code: getErrorCode(err)
                }
            });
        }
        stream.end();

    };

    base(table).select().eachPage(onPageRetrieved, onFetchingComplete);
});

app.listen(process.env.PORT || 8080);