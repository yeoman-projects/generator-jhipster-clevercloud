const chalk = require('chalk');
const packagejs = require('../../package.json');
const semver = require('semver');
const BaseGenerator = require('generator-jhipster/generators/generator-base');
const jhipsterConstants = require('generator-jhipster/generators/generator-constants');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const parseStringSync = require('xml2js-parser').parseStringSync;
const fs = require('fs');
const opn = require('opn');
const unidecode = require("unidecode");
const clever = require("./api.js")();
const Logger = require("./logger.js");
const Bacon = require('baconjs');
const supportedDatabases = ['postgresql','mysql','mongodb'];
const dbPlans = {
    postgresql:[
                { name: 'DEV 	5 	10 MB 	Shared 	Shared 	0.00 €', value: 'dev', maxConnection: 5 },
                { name: 'S 	10 	256 MB 	Shared 	Shared 	15.00 €	', value: 's', maxConnection: 10 },
                { name: 'M 	75 	10 GB 	1 GB 	1 	45.00 €	', value: 'm', maxConnection: 75 },
                { name: 'LM 	140 	50 GB 	1 GB 	2 	110.00 €', value: 'lm', maxConnection: 140 },
                { name: 'L 	500 	200 GB 	2 GB 	2 	300.00 €', value: 'l', maxConnection: 500 },
    ],
    mysql:[
                { name: 'DEV 	256 MB 	5 	Shared 	Shared 	0.00 €', value: 'dev', },
                { name: 'S 	1 GB 	10 	Shared 	Shared 	10.00 €', value: 's', maxConnection: 10 },
                { name: 'M 	100 GB 	75 	1 GB 	1 	30.00 €', value: 'm', maxConnection: 75 },
                { name: 'LM 	150 GB 	150 	3 GB 	2 	100.00 €', value: 'lm', maxConnection: 150 },
                { name: 'L 	450 GB 	500 	8 GB 	4 	240.00 €', value: 'l', maxConnection: 500 },
                { name: 'XL 	600 GB 	750 	32 GB 	6 	700.00 €', value: 'xl', maxConnection: 750 },
    ],
    mongodb:[
                { name: 'Peanut 	500 MB 	    Shared 	0.00 € 	', value: 'peanut' },
                { name: 'Hazelnut 	1 GB 	    512 MB 	20.00 € 	', value: 'hazelnut' },
                { name: 'Shamrock 	5 GB 	    1 GB 	40.00 € 	', value: 'shamrock' },
                { name: 'Vine 	30 GB 	    2 GB 	75.00 € 	', value: 'vine' },
                { name: 'Gunnera 	100 GB 	    4 GB 	150.00 €', value: 'gunnera' }
    ]
};
var client;
var organisations;
var appChoices;
var organisationAddons;
const createDBPrompt = { name: `Create a new DB`, value: {create:true} };
getOrganisationAddons = function(orgaId, addonType) {
    return client.owner(orgaId).addons.get().withParams(orgaId ? [orgaId] : []).send().
        flatMapLatest(function(addons) {
            organisationAddons = addons.filter((a) => {
                return (a.provider.id == (addonType+"-addon"));
            }).map((a) => {
                return {name:a.name,value:{id:a.id, create:false, plan : a.plan.slug}};
            });
            organisationAddons.push(createDBPrompt);
        }).toPromise();
};
getCleverConfig = function() {
    return fs.existsSync(".clever.json")?
        JSON.parse(fs.readFileSync(".clever.json"))
        :{apps:[]};
}
getCurrentApplicationId = function(appName){
    var applicationid;
    var cleverConfig = getCleverConfig();
    cleverConfig.apps.forEach((app) => {
        if (app.alias == appName) {
            applicationid = app.app_id;
        }
    });
    return applicationid;
}
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
                this.log(`${chalk.cyan.bold('   ____ _                        ____ _                 _ ')}`);
                this.log(`${chalk.cyan.bold('  / ___| | _____   _____ _ __   / ___| | ___  _   _  __| |')}`);
                this.log(`${chalk.cyan.bold(' | |   | |/ _ \\ \\ / / _ \\  __| | |   | |/ _ \\| | | |/ _  |')}`);
                this.log(`${chalk.cyan.bold(' | |___| |  __/\\ V /  __/ |    | |___| | (_) | |_| | (_| |')}`);
                this.log(`${chalk.cyan.bold('  \\____|_|\\___| \\_/ \\___|_|     \\____|_|\\___/ \\__,_|\\__,_|')}`);
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
            },
            setAPIClient() {
                return clever.first().toPromise().then(function (api){
                    client = api;
                });
            },
            setOrganisations() {
                return client.summary.get().send().map(".organisations").flatMapLatest(function(orgs) {
                    if(orgs.length === 0) {
                        return Bacon.once(new Bacon.Error("Organisation not found"));
                    } else {
                        var o = orgs.map((org) => {return {value:org.id, name:org.name};});
                        organisations = o;
                    }
                }).toPromise();
            },
            setLinkedApplications() {
                appChoices = getCleverConfig().apps.map((app) => {return { name: app.name, value: app.alias};} );
            }
        };
    }

    promptOrgAndApp() {
        const done = this.async();
        const prompts = [
        {
            when: response => organisations,
            type: 'list',
            name: 'user',
            message: 'Deploy as Organization or User:',
            choices: organisations,
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
    initAddons(){
         return getOrganisationAddons(this.props.user, this.jhipsterAppConfig.prodDatabaseType);
    }
    promptDB() {
        if (supportedDatabases.indexOf(this.jhipsterAppConfig.prodDatabaseType) == -1) {
            this.log('The database you are using is currently unsupported by Clever Cloud.');
        }
        const done = this.async();
        const prompts = [ {
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
            when: response => response.dbManaged,
            type: 'list',
            name: 'createDB',
            message: 'Do you want Clever Cloud to create a new database?:',
            choices: organisationAddons,
        }, {
            when: response => response.createDB && response.createDB.create && response.dbManaged && this.jhipsterAppConfig.prodDatabaseType === 'mongodb',
            type: 'list',
            name: 'dbPlan',
            message: 'Select your database plan\nPlan name 	Max DB size 	Memory 	Price',
            choices: dbPlans.mongodb,
            default: 'peanut'
        }, {
            when: response => response.createDB && response.createDB.create && response.dbManaged && this.jhipsterAppConfig.prodDatabaseType === 'postgresql',
            type: 'list',
            name: 'dbPlan',
            message: 'Select your database plan\nPlan name 	Max connection limit 	Max db size 	Memory 	vCPUS 	Price',
            choices: dbPlans.postgresql,
            default: 'dev'
        }, {
            when: response => response.createDB && response.createDB.create && response.dbManaged && this.jhipsterAppConfig.prodDatabaseType === 'mysql',
            type: 'list',
            name: 'dbPlan',
            message: 'Select your database plan\nPlan name 	Max connection limit 	Max db size 	Memory 	vCPUS 	Price',
            choices: dbPlans.mysql,
            default: 'dev'
        }];
        this.prompt(prompts).then((props) => {
            this.props = Object.assign({},this.props, props);
            if (!this.props.dbPlan) {
                this.props.dbPlan = this.props.createDB.plan;
            }
            done();
        });
    }

    writing() {
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
        const currentDBPlan = dbPlans[this.jhipsterAppConfig.prodDatabaseType].
          filter((p) => {return p.value == this.props.dbPlan})[0];
        currentDBPlan.maxConnection ? this.maxConnections = Math.floor((currentDBPlan.maxConnection) / 2): this.maxConnections = 0;
        // variable from questions
        this.message = this.props.message;
        const organizationSegment = this.props.user.startsWith("user")?"": " -o " + this.props.user + " ";
        const aliasSegment = " -a " + this.props.alias + " "; 
        const appRegion = this.props.region == "eu" ? "par" :"mtl" ;
        const appRegionSegment = " --region " + appRegion + " ";
        if (this.buildTool === 'maven') {
            const pom = fs.readFileSync('pom.xml');
            const jsPom = parseStringSync(pom);
            this.version = jsPom.project.version;  
            this.template('_maven.json', 'clevercloud/maven.json');
            if (!this.props.useExistingApp) {
                var msg = execSync('clever create --type maven ' + appRegionSegment + organizationSegment + aliasSegment + this.props.appName);
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
        if (this.props.createDB && this.props.createDB.create && this.props.dbPlan) {
            const addonRegionSegment = " --region " + this.props.region + " ";
            const addonName = "'[JHipster]["+this.props.dbPlan+"] "+ this.props.appName + "'";
            execSync('clever addon create ' + organizationSegment + this.prodDatabaseType + '-addon '+'--plan ' + this.props.dbPlan + ' ' + addonRegionSegment + addonName);
            execSync('clever service link-addon ' + addonName + aliasSegment);
        }
        if (this.props.createDB ) {
            if (!this.props.createDB.create) execSync('clever service link-addon ' + this.props.createDB.id + aliasSegment);
        }
        execSync('clever env set CC_PRE_RUN_HOOK "cp ./clevercloud/application-clevercloud.yml ./application-prod.yml"' + aliasSegment);
    }


    install(){
        var applicationId = getCurrentApplicationId(this.props.alias);
        return client.owner(this.props.user).applications._.put()
            .withParams( [this.props.user, applicationId])
            .send(JSON.stringify({separateBuild:true})).toPromise().toPromise().catch(error => {
                this.log(`${chalk.yellow.bold('WARNING!')} Unable to dedicated build instance.`);
            });
    }

    end() {
        var applicationId =  getCurrentApplicationId(this.props.alias);
        const user = this.props.user.startsWith("user") ?
          "users/me": "organisations/"+this.props.user;
        const consoleURL = "https://console.clever-cloud.com/" + user + "/applications/" + applicationId;
        this.log('Now you can commit the file we have generated by running:');
        this.log(`  ${chalk.bold.cyan('git add clevercloud && git commit -m"add clevercloud support"')}`);
        this.log('And deploy your application to Clever cloud with: ');
        this.log(`  ${chalk.bold.cyan('clever deploy')}`);
        this.log('Then you can open your application with:');
        this.log(`  ${chalk.bold.cyan('clever open')}`);
        this.log("Your can also access the app on Clever Cloud's web console by visiting:");
        this.log(`  ${chalk.bold.cyan(consoleURL)}`);
    }

};
