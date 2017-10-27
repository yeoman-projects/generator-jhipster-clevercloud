const chalk = require('chalk');
const packagejs = require('../../package.json');
const semver = require('semver');
const BaseGenerator = require('generator-jhipster/generators/generator-base');
const jhipsterConstants = require('generator-jhipster/generators/generator-constants');
const exec = require('child_process').exec;
const parseStringSync = require('xml2js-parser').parseStringSync;
const fs = require('fs');
const opn = require('opn');
const unidecode = require("unidecode");
const dbPlans = {
    postgresql:[
                { name: 'DEV 	5 	10 MB 	Shared 	Shared 	0.00 €', value: 'dev', maxConnection: 5 },
                { name: 'S 	10 	256 MB 	Shared 	Shared 	15.00 €	', value: 's', maxConnection: 10 },
                { name: 'M 	75 	10 GB 	1 GB 	1 	45.00 €	', value: 'm', maxConnection: 75 },
                { name: 'LM 	140 	50 GB 	1 GB 	2 	110.00 €', value: 'lm', maxConnection: 140 },
                { name: 'L 	500 	200 GB 	2 GB 	2 	300.00 €', value: 'l', maxConnection: 500 },
    ],
    mysql:[
                { name: 'DEV 	256 MB 	5 	Shared 	Shared 	0.00 €', value: 'dev' },
                { name: 'S 	1 GB 	10 	Shared 	Shared 	10.00 €', value: 's' },
                { name: 'M 	100 GB 	75 	1 GB 	1 	30.00 €', value: 'm' },
                { name: 'LM 	150 GB 	150 	3 GB 	2 	100.00 €', value: 'lm' },
                { name: 'L 	450 GB 	500 	8 GB 	4 	240.00 €', value: 'l' },
                { name: 'XL 	600 GB 	750 	32 GB 	6 	700.00 €', value: 'xl' },
    ],
    mongodb:[
                { name: 'Peanut 	500 MB 	    Shared 	0.00 € 	', value: 'peanut' },
                { name: 'Hazelnut 	1 GB 	    512 MB 	20.00 € 	', value: 'hazelnut' },
                { name: 'Shamrock 	5 GB 	    1 GB 	40.00 € 	', value: 'shamrock' },
                { name: 'Vine 	30 GB 	    2 GB 	75.00 € 	', value: 'vine' },
                { name: 'Gunnera 	100 GB 	    4 GB 	150.00 €', value: 'gunnera' }
    ]
};


module.exports = class extends BaseGenerator {
    get initializing() {
        return {
            readConfig() {
                this.jhipsterAppConfig = this.getJhipsterAppConfig();
                if (!this.jhipsterAppConfig) {
                    this.error('Can\'t read .yo-rc.json');
                }
            },
            displayLogo() {
                this.log('');
                this.log(`${chalk.cyan.bold('    ____ _                        ____ _                 _ ')}`);
                this.log(`${chalk.cyan.bold('  / ___| | _____   _____ _ __   / ___| | ___  _   _  __| |')}`);
                this.log(`${chalk.cyan.bold(' | |   | |/ _ \ \ / / _ \ \'__| | |   | |/ _ \| | | |/ _` |')}`);
                this.log(`${chalk.cyan.bold(' | |___| |  __/\ V /  __/ |    | |___| | (_) | |_| | (_| |')}`);
                this.log(`${chalk.cyan.bold('  \____|_|\___| \_/ \___|_|     \____|_|\___/ \__,_|\__,_|')}`);
                this.log(`${chalk.cyan.bold('                                                          ')}`);
                this.log(`${chalk.white.bold(' https://www.clever-cloud.com')}`);
                this.log(`\nWelcome to the ${chalk.bold.yellow('JHipster Clever Cloud')} generator! ${chalk.yellow(`v${packagejs.version}\n`)}`);
            },
            checkCleverTools() {
                const done = this.async();
                exec('clever --version', (err, stdout) => {
                    if (err) {
                        this.log(`${chalk.yellow.bold('WARNING!')} You don't have clever tools installed.`);
                        this.log(`${chalk.yellow.bold('WARNING!')}  Learn how to install it on https://www.clever-cloud.com/doc/clever-tools/getting_started/#installing-clever-tools`);
                        this.log(`${chalk.yellow.bold('WARNING!')} The generator will now stop.`);
                        process.exit(1);
                    }
                    done();
                });
            }
        };
    }

    prompting() {
        var cleverConfig = this.fs.readJSON(".clever.json");
        if (!cleverConfig) {
            this.log('No existing clever cloud application');
            this.cleverConfig = {apps:[]};
        } else {
            this.cleverConfig = cleverConfig;
            this.log(this.cleverConfig.apps);
        }
        const appChoices = this.cleverConfig.apps.map((app) => {return { name: app.name, value: app.alias};} );
        const done = this.async();
        const supportedDatabases = ['postgresql','mysql','mongodb'];
        if (supportedDatabases.indexOf(this.jhipsterAppConfig.prodDatabaseType) == -1) {
            this.log('The database you are using is currently unsupported by Clever Cloud.');
        }
        const prompts = [
        {
            type: 'input',
            name: 'user',
            message: 'Deploy as OrganizationId or UserId (leave empty for personal space):',
            store: true
        }, {
            type: 'list',
            name: 'region',
            message: 'On which region do you want to deploy ?',
            choices: ['us', 'eu'],
            store: true
        }, {
            when: response => appChoices.length > 0,
            type: 'list',
            name: 'useExistingApp',
            message: 'Seems you already have a Clever Cloud App linked to this project, should we use it?:',
            choices: [
                { name: `Yes`, value: true },
                { name: 'No', value: false },
            ],
            default: true
        }, {
            when: response => response.useExistingApp,
            type: 'list',
            name: 'alias',
            message: 'Select your application?:',
            choices: appChoices,
            default: true
        }, {
            when: response => !response.useExistingApp,
            type: 'input',
            validate: (input) => {
                const aliases = appChoices.map((app) => {return app.value;});
                const aliasedInput = unidecode(input).replace(/[^a-zA-z0-9]+/gi, "-").toLowerCase();
                if (aliases.indexOf(aliasedInput) < 0) return true;
                return 'The application name you chose is already used for an existing linked application.';
            },
            name: 'appName',
            message: 'Name to deploy as:',
            default: this.jhipsterAppConfig.baseName
        }, {
            when: response => supportedDatabases,
            type: 'list',
            name: 'dbManaged',
            message: 'Do you want Clever Cloud to manage your Database:',
            choices: [
                { name: `Yes`, value: true },
                { name: 'No', value: false },
            ],
            default: true
        }, {
            when: response => response.dbManaged && this.jhipsterAppConfig.prodDatabaseType === 'mongodb',
            type: 'list',
            name: 'dbPlan',
            message: 'Select your database plan\nPlan name 	Max DB size 	Memory 	Price',
            choices: dbPlans.mongodb,
            default: 'peanut'
        }, {
            when: response => response.dbManaged && this.jhipsterAppConfig.prodDatabaseType === 'postgresql',
            type: 'list',
            name: 'dbPlan',
            message: 'Select your database plan\nPlan name 	Max connection limit 	Max db size 	Memory 	vCPUS 	Price',
            choices: dbPlans.postgresql,
            default: 'dev'
        }, {
            when: response => response.dbManaged && this.jhipsterAppConfig.prodDatabaseType === 'mysql',
            type: 'list',
            name: 'dbPlan',
            message: 'Select your database plan\nPlan name 	Max connection limit 	Max db size 	Memory 	vCPUS 	Price',
            choices: dbPlans.mysql,
            default: 'dev'
        }];

        this.prompt(prompts).then((props) => {
            this.props = props;
            if (props.alias) {
                appChoices.forEach((app) => {if(app.value == props.alias) this.props.appName = app.name; });
            }
            if (props.appName) {
                this.props.alias = unidecode(props.appName).replace(/[^a-zA-z0-9]+/gi, "-").toLowerCase()
            }
            // To access props later use this.props.someOption;
            done();
        });
    }

    writing() {
        // function to use directly template
        this.template = function (source, destination) {
            this.fs.copyTpl(
                this.templatePath(source),
                this.destinationPath(destination),
                this
            );
        };

        // read config from .yo-rc.json
        this.baseName = this.jhipsterAppConfig.baseName;
        this.buildTool = this.jhipsterAppConfig.buildTool;
        this.prodDatabaseType = this.jhipsterAppConfig.prodDatabaseType;

        // variable from questions
        this.message = this.props.message;
        const organizationSegment = this.props.user.length  === 0 || !this.props.user.trim()?"": " -o " + this.props.user + " ";
        const aliasSegment = " -a " + this.props.alias + " "; 
        const appRegion = this.props.region == "eu" ? "par" :"mtl" ;
        const appRegionSegment = " --region " + appRegion + " ";
        if (this.buildTool === 'maven') {
            const pom = fs.readFileSync('pom.xml');
            const jsPom = parseStringSync(pom);
            this.version = jsPom.project.version;  
            this.template('_maven.json', 'clevercloud/maven.json');
            if (!this.props.useExistingApp) {
                const done = this.async();
                exec('clever create --type maven ' + appRegionSegment + organizationSegment + aliasSegment + this.props.appName, (err) => {
                    if (err) {
                        this.error(`${chalk.yellow.bold('WARNING!')} Something went wrong.`);
                        this.error(err);
                    }
                    done();
                });
            }
        }
        if (this.buildTool === 'gradle') {
                const done = this.async();
                exec('gradle properties', (err, stdout) => {
                    if (err) {
                        this.error(`${chalk.yellow.bold('WARNING!')} We could not determine the version of your project. `);
                        this.error(err);
                    } else {
                        const rePattern = /^version: (.*)$/m;
                        const arrMatches = stdout.match(rePattern);
                        this.log(arrMatches[1]);
                        this.version = arrMatches[1];
                        this.template('_gradle.json', 'clevercloud/gradle.json');
                        if (!this.props.useExistingApp) {
                            const done = this.async();
                            const cmd = 'clever create --type gradle ' + appRegionSegment + organizationSegment + aliasSegment + this.props.appName;
                            this.info("Creating a new Gradle Applicaiton on Clever Cloud\n" + cmd + "\n");
                            exec(cmd, (err) => {
                                if (err) {
                                    this.error(`${chalk.yellow.bold('WARNING!')} Something went wrong.`);
                                    this.error(err);
                                }
                                done();
                            });
                        }
                    }
                    done();
                });
        }
        this.template('_application-clevercloud.yml', 'clevercloud/application-clevercloud.yml');
        if (this.props.dbPlan) {
            const addonRegionSegment = " --region " + this.props.region + " ";
            const done = this.async();
            exec('clever addon create '+ this.prodDatabaseType + '-addon '+'--plan ' + this.props.dbPlan + ' ' + addonRegionSegment + this.baseName, (err) => {
                if (err) {
                    this.log(`${chalk.yellow.bold('WARNING!')} Something went wrong.`);
                }
                done();
            });
            const serviceLinkDone = this.async();
            exec('clever service link-addon ' + this.baseName, (err) => {
                if (err) {
                    this.log(`${chalk.yellow.bold('WARNING!')} Something went wrong.`);
                }
                serviceLinkDone();
            });
        }
        const prehookDone = this.async();
        exec('clever env set CC_PRE_RUN_HOOK "cp ./clevercloud/application-clever.yml ./application-prod.yml"', (err) => {
            if (err) {
                this.log(`${chalk.yellow.bold('WARNING!')} Something went wrong.`);
            }
            prehookDone();
        });
    }

    install() {
        var cleverConfig = this.fs.readJSON(".clever.json");
        if (!cleverConfig) {
            this.log('No existing clever cloud application');
            this.cleverConfig = {apps:[]};
        } else {
            this.cleverConfig = cleverConfig;
        }
        var applicationId;
        this.cleverConfig.apps.forEach((app) => {
            if (app.alias == this.props.alias) {
                applicationId = app.app_id;
            }
        });
        const user = this.props.user.length  === 0 || !this.props.user.trim() ? "me": this.props.user;
        const consoleURL = "https://console.clever-cloud.com/users/" + user + "/applications/" + applicationId + "/information";
        opn(consoleURL);
        this.log('Please make sure you tick the *Dedicated build instance* Checkbox.');
        this.log('Now you can commit the file we have generated:');
        this.log('git add clevercloud && git commit -m"add clevercloud support"');
        this.log('And deploy your application to Clever cloud with: ');
        this.log('clever deploy');
    }

    end() {

    }
};
